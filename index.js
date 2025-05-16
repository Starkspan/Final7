
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const pdf = require("pdf-parse");
const app = express();
const port = process.env.PORT || 10000;
const upload = multer();

app.use(cors());
app.use(express.json());

app.post("/pdf/analyze", upload.single("pdf"), async (req, res) => {
  try {
    const dataBuffer = req.file.buffer;
    const pdfData = await pdf(dataBuffer);
    const text = pdfData.text.replace(/\n/g, " ");

    function extract(pattern, fallback = null) {
      const match = text.match(pattern);
      return match && match[1] ? match[1].trim() : fallback;
    }

    const teilname = extract(/(Greiferhalter[^\s]+)/i) || extract(/Benennung\s*[:=]?\s*([\w\- ]+)/i, "k.A.");
    const zeichnung = extract(/(\b[A-Z]{2,}\d{3,}\b)/i) || extract(/Zeichnungsnummer\s*[:=]?\s*(\w+)/i, "k.A.");
    
let material = extract(/Material\s*[:=]?\s*([\w\.\-\/ ]+)/i)
            || extract(/Werkstoff\s*[:=]?\s*([\w\.\-\/ ]+)/i)
            || extract(/(1\.[0-9]{4})/)
            || extract(/(3\.[0-9]{4})/)
            || "stahl";
if (material.includes("3.4365") || material.toLowerCase().includes("aluminium")) {
  material = "aluminium";
}

    const gewichtMatch = extract(/(\d+[\.,]?\d*)\s?kg/i, null);
    const gewicht = gewichtMatch ? parseFloat(gewichtMatch.replace(",", ".")) : null;

    const durchmesser = extract(/Ø\s?(\d+[\.,]?\d*)/, null);
    const laenge = extract(/L(?:=|\s)?(\d+[\.,]?\d*)/, null);

    let masse = "nicht sicher erkannt";
    let gewichtCalc = gewicht;
    let x1 = 0, x2 = 0, x3 = 0;
    let form = "k.A.";

    if (durchmesser && laenge) {
      const d = parseFloat(durchmesser.replace(",", "."));
      const l = parseFloat(laenge.replace(",", "."));
      const radius = d / 2;
      const volumen = Math.PI * radius * radius * l / 1000;
      masse = `Ø${d} × ${l} mm`;
      
const dichte = material.toLowerCase().includes("aluminium") ? 2.7 : 7.85;
gewichtCalc = gewichtCalc || volumen * dichte;

      x1 = d;
      x2 = l;
      form = "Zylinder";
    } else if (text.match(/(\d{2,4})\s?[xX*]\s?(\d{2,4})\s?[xX*]\s?(\d{2,4})/)) {
      const m = text.match(/(\d{2,4})\s?[xX*]\s?(\d{2,4})\s?[xX*]\s?(\d{2,4})/);
      const [a, b, c] = [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
      masse = `${a} x ${b} x ${c} mm`;
      const volumen = (a / 1000) * (b / 1000) * (c / 1000);
      
const dichte = material.toLowerCase().includes("aluminium") ? 2.7 : 7.85;
gewichtCalc = gewichtCalc || volumen * dichte;

      x1 = a; x2 = b; x3 = c;
      form = "Platte";
    }

    const kgPreise = {
      stahl: 1.5,
      edelstahl: 6.5,
      aluminium: 7.0,
      messing: 8.0,
      kupfer: 10.0,
      "1.4301": 6.5,
      "1.2210": 1.5
    };

    const matKey = material.toLowerCase();
    const matpreis = kgPreise[matKey] || 1.5;
    const rüst = 60;
    const prog = 30;
    const laufzeit = gewichtCalc ? gewichtCalc * 2 : 1;
    const laufzeitStd = laufzeit / 60;
    const bearbeitung = laufzeitStd * 35;
    const matkosten = gewichtCalc * matpreis;
    const stück1 = ((matkosten + bearbeitung + rüst + prog) / 1) * 1.15;
    const stück10 = ((matkosten + bearbeitung + rüst + prog) / 10) * 1.15;
    const stück100 = ((matkosten + bearbeitung + rüst + prog) / 100) * 1.15;

    res.json({
      teilname, zeichnung, material, form, masse,
      gewicht: gewichtCalc ? gewichtCalc.toFixed(3) + " kg" : "k.A.",
      preis: {
        "1 Stk": stück1.toFixed(2) + " €",
        "10 Stk": stück10.toFixed(2) + " €",
        "100 Stk": stück100.toFixed(2) + " €"
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysefehler" });
  }
});

app.listen(port, () => {
  console.log("✅ Server läuft auf Port " + port);
});
