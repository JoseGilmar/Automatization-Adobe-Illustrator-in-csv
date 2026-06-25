// =============================================================
// FUTSHOP KIT CUSTOMIZATION SCRIPT — ExtendScript ES3
// Items placed ABOVE the canvas in the pasteboard area,
// in strict top-to-bottom columns that wrap left-to-right.
// =============================================================

function trim(s) { return s.replace(/^\s+|\s+$/g, ""); }

var CONFIG = {
    canvasWidth:  1700.08,  // 57cm in points

    // Pasteboard placement: items sit ABOVE the canvas.
    // In Illustrator coords, canvas top-left is (0, 0).
    // Pasteboard above = negative Y values (top of item at e.g. -50 means 50pt above canvas).
    pasteboardMargin: 50,     // gap between canvas top edge and bottom of pasteboard items
    colMaxHeight:     2000,   // ~70cm — max column height before starting new column
    itemGap:          28.3465, // 1cm gap between items
    colGap:           56.693,  // 2cm gap between columns
    startX:           0,       // start at left edge of canvas (x=0), go rightward

    kits: {
        "escudo": {
            fontName:         "Binaria-Bold",
            color:            { r: 146, g: 154, b: 150 },
            nameHeight:       93.54,
            nameHeightAccent: 119.06,
            numHeight:        601.15
        },
        "roxa": {
            fontName:         "Superclarendon-Regular",
            color:            { r: 255, g: 255, b: 255 },
            nameHeight:       93.54,
            nameHeightAccent: 119.06,
            numHeight:        601.15
        },
        "coracoes": {
            fontName:         "Lobster-Regular",
            color:            { r: 50,  g: 69,  b: 104 },
            stroke:           { r: 255, g: 255, b: 255 },
            nameHeight:       155.91,
            nameHeightAccent: 218.27,
            numHeight:        601.15
        },
        "glove": {
            fontName:         "FormulaCondensed-Bold",
            nameHeight:       34.02,
            nameHeightAccent: 39.69
        }
    }
};

function cmToPt(cm) { return cm * 28.3465; }

// ALL CAPS for non-Lobster names
function toAllCaps(s) { return s.toUpperCase(); }

// Title Case for Lobster: first letter of each word capitalised, rest lowercase
function toTitleCase(s) {
    var words = s.split(" ");
    var out = [];
    for (var i = 0; i < words.length; i++) {
        var w = words[i];
        if (w.length === 0) { out.push(w); continue; }
        out.push(w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    }
    return out.join(" ");
}

function hasAccent(str) {
    return /[áéíóúàèìòùâêîôûãõçñüÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÃÕÇÑÜ]/.test(str);
}

function detectKit(produto) {
    var p = produto.toLowerCase();
    if (p.indexOf("todos os cora") !== -1)  return "coracoes";
    if (p.indexOf("roxa") !== -1)           return "roxa";
    if (p.indexOf("escudo noturno") !== -1) return "escudo";
    if (p.indexOf("luva") !== -1)           return "glove";
    return null;
}

function makeColor(rgb) {
    var c = new RGBColor();
    c.red = rgb.r; c.green = rgb.g; c.blue = rgb.b;
    return c;
}

function createOutlines(doc, layer, tf) {
    var before = {};
    for (var k = 0; k < layer.pageItems.length; k++)
        before[layer.pageItems[k].uuid] = true;
    doc.selection = null;
    tf.selected = true;
    app.executeMenuCommand("outline");
    app.redraw();
    for (var k = 0; k < layer.pageItems.length; k++) {
        var it = layer.pageItems[k];
        if (!before[it.uuid]) return it;
    }
    return (doc.selection && doc.selection.length > 0) ? doc.selection[0] : null;
}

function makeVectorItem(doc, layer, text, fontName, fillRgb, strokeRgb, strokeWt, targetHeight) {
    var tf = layer.textFrames.add();
    tf.contents = text;
    var attr = tf.textRange.characterAttributes;
    attr.textFont  = app.textFonts.getByName(fontName);
    attr.size      = 90;
    attr.fillColor = makeColor(fillRgb);
    if (strokeRgb) {
        attr.strokeColor  = makeColor(strokeRgb);
        attr.strokeWeight = strokeWt || 2;
    }
    var item = createOutlines(doc, layer, tf);
    if (!item) { alert("Failed to outline: " + text); return null; }
    if (strokeRgb) {
        doc.selection = [item];
        app.executeMenuCommand("Live Pathfinder Add");
        app.redraw();
        app.executeMenuCommand("expandStyle");
        app.redraw();
        if (doc.selection && doc.selection.length > 0) item = doc.selection[0];
    }
    var sf = (targetHeight / item.height) * 100;
    item.resize(sf, sf, true, true, true, true, sf);
    // Second expand for Lobster: flatten any remaining appearance after scaling
    if (strokeRgb) {
        doc.selection = [item];
        app.executeMenuCommand("expandStyle");
        app.redraw();
        if (doc.selection && doc.selection.length > 0) item = doc.selection[0];
    }
    return item;
}

function parseInfo(info, kit) {
    var items = [], str = info;
    if (kit === "glove") {
        str = str.replace(/cor da letra:\s*\S+\s*/i, "");
        var rM = str.match(/M.o Direita:\s*(.+?)(?=Personalize|M.o Esquerda:|$)/i);
        var lM = str.match(/M.o Esquerda:\s*(.+?)(?=Personalize|M.o Direita:|$)/i);
        if (rM) { var t  = trim(rM[1]); if (t)  items.push({ text: t,  type: "glove" }); }
        if (lM) { var t2 = trim(lM[1]); if (t2) items.push({ text: t2, type: "glove" }); }
        return items;
    }
    var nM = str.match(/seu nome[^:]*:\s*([^\n]+?)(?=\s+Inclua|\s*$)/i);
    var dM = str.match(/seu n.mero[^:]*:\s*(\d+)/i);
    if (nM) { var nm = trim(nM[1]); if (nm) items.push({ text: nm, type: "name" }); }
    if (dM) { var dm = trim(dM[1]); if (dm) items.push({ text: dm, type: "number" }); }
    return items;
}

function splitCSVLine(line) {
    var result = [], cur = "", inQ = false;
    for (var i = 0; i < line.length; i++) {
        var ch = line.charAt(i);
        if (ch === '"') { inQ = !inQ; }
        else if (ch === "," && !inQ) { result.push(cur); cur = ""; }
        else { cur += ch; }
    }
    result.push(cur);
    return result;
}

// Place an array of items in columns above the canvas.
// Items flow top→bottom, then start a new column to the right.
// bottomY = the Y coordinate of the canvas top edge (items go above this).
function layoutAboveCanvas(items, startX, bottomY, colMaxHeight, itemGap, colGap) {
    if (!items || items.length === 0) return 0; // returns rightmost X used

    var curX     = startX;
    var colItems = [];  // items in current column
    var colH     = 0;   // accumulated height in current column
    var colW     = 0;   // max width in current column

    function placeColumn() {
        // Place items in this column, bottom-aligned to bottomY
        var y = bottomY - CONFIG.pasteboardMargin; // start from bottom of pasteboard zone
        for (var n = colItems.length - 1; n >= 0; n--) {
            var it = colItems[n];
            y -= it.height;
            it.left = curX;
            it.top  = -y;   // Illustrator: top = negative of y-from-top
            y -= itemGap;
        }
    }

    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var neededH = it.height + (colItems.length > 0 ? itemGap : 0);

        if (colItems.length > 0 && colH + neededH > colMaxHeight) {
            // Flush current column
            placeColumn();
            curX += colW + colGap;
            colItems = [];
            colH = 0;
            colW = 0;
        }

        colItems.push(it);
        colH += neededH;
        if (it.width > colW) colW = it.width;
    }

    // Flush last column
    if (colItems.length > 0) {
        placeColumn();
        curX += colW;
    }

    return curX; // rightmost edge used
}

// ---------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------
function main() {
    var csvFile = File.openDialog("Select the orders CSV file", "*.csv");
    if (!csvFile) { alert("No file selected."); return; }
    csvFile.encoding = "UTF-8";
    if (!csvFile.open("r")) { alert("Could not open file."); return; }
    var raw = csvFile.read();
    csvFile.close();

    var lines = raw.split(/\r?\n/);
    if (lines.length < 2) { alert("CSV appears empty."); return; }

    var doc;
    if (app.documents.length === 0) {
        var preset = new DocumentPreset();
        preset.width     = CONFIG.canvasWidth;
        preset.height    = cmToPt(50);
        preset.colorMode = DocumentColorSpace.RGB;
        preset.units     = RulerUnits.Centimeters;
        doc = app.documents.addDocument("", preset);
    } else {
        doc = app.activeDocument;
    }

    var mainLayer = doc.layers[0];
    mainLayer.name = "Kit Items";

    var buildLayer;
    try { buildLayer = doc.layers.add(); buildLayer.name = "_build"; }
    catch(e) { buildLayer = mainLayer; }

    var buckets = {
        "escudo_numbers":   [],
        "roxa_numbers":     [],
        "coracoes_numbers": [],
        "escudo_names":     [],
        "roxa_names":       [],
        "coracoes_names":   [],
        "glove_items":      []
    };

    var totalItems = 0;

    for (var i = 1; i < lines.length; i++) {
        var line = trim(lines[i]);
        if (!line) continue;
        var cols = splitCSVLine(line);
        if (cols.length < 4) continue;

        var kit = detectKit(cols[2]);
        if (!kit) continue;
        var kitCfg = CONFIG.kits[kit];
        var items  = parseInfo(cols[3], kit);

        for (var j = 0; j < items.length; j++) {
            var entry = items[j];

            // Apply casing: Lobster = Title Case, all others = ALL CAPS (numbers unchanged)
            var displayText = entry.text;
            if (entry.type === "name" || entry.type === "glove") {
                if (kit === "coracoes") {
                    displayText = toTitleCase(entry.text);
                } else {
                    displayText = toAllCaps(entry.text);
                }
            }

            if (kit === "glove") {
                var targetH = hasAccent(displayText) ? kitCfg.nameHeightAccent : kitCfg.nameHeight;
                var w = makeVectorItem(doc, buildLayer, displayText, kitCfg.fontName, {r:255,g:255,b:255}, null, 0, targetH);
                var b = makeVectorItem(doc, buildLayer, displayText, kitCfg.fontName, {r:0,  g:0,  b:0  }, null, 0, targetH);
                if (w) buckets["glove_items"].push(w);
                if (b) buckets["glove_items"].push(b);
                totalItems += 2;
            } else {
                var th, bk;
                if (entry.type === "number") {
                    th = kitCfg.numHeight; bk = kit + "_numbers";
                } else {
                    th = hasAccent(displayText) ? kitCfg.nameHeightAccent : kitCfg.nameHeight;
                    bk = kit + "_names";
                }
                var sr = (kit === "coracoes") ? kitCfg.stroke : null;
                var it = makeVectorItem(doc, buildLayer, displayText, kitCfg.fontName, kitCfg.color, sr, 2, th);
                if (it) { buckets[bk].push(it); totalItems++; }
            }
        }
    }

    // Move all items to main layer, then lay out above canvas
    var bucketOrder = [
        "escudo_numbers", "roxa_numbers", "coracoes_numbers",
        "escudo_names",   "roxa_names",   "coracoes_names",
        "glove_items"
    ];

    // bottomY = 0 means canvas top. Items placed above = positive Y values
    // (item.top in Illustrator is negative when above canvas top)
    var curX = CONFIG.startX;
    var bucketGap = CONFIG.colGap * 3; // wider gap between buckets

    for (var b = 0; b < bucketOrder.length; b++) {
        var bKey   = bucketOrder[b];
        var bItems = buckets[bKey];
        if (bItems.length === 0) continue;

        for (var n = 0; n < bItems.length; n++)
            bItems[n].move(mainLayer, ElementPlacement.PLACEATEND);

        var rightEdge = layoutAboveCanvas(
            bItems, curX, 0,
            CONFIG.colMaxHeight, CONFIG.itemGap, CONFIG.colGap
        );

        // Group the bucket
        if (bItems.length > 1) {
            doc.selection = null;
            for (var n = 0; n < bItems.length; n++) bItems[n].selected = true;
            var grp = doc.groupItems.add();
            for (var n = 0; n < bItems.length; n++) bItems[n].moveToBeginning(grp);
            grp.name = bKey;
            grp.move(mainLayer, ElementPlacement.PLACEATEND);
        } else if (bItems.length === 1) {
            bItems[0].name = bKey;
        }

        curX = rightEdge + bucketGap;
    }

    try {
        if (buildLayer !== mainLayer && buildLayer.pageItems.length === 0)
            buildLayer.remove();
    } catch(e) {}

    alert("Done! " + totalItems + " items placed above the canvas.\nDrag items down onto the canvas to arrange your roll.");
}

main();
