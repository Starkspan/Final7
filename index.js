
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const pdf = require("pdf-parse");

const app = express();
app.use(cors());
const upload = multer({ storage: multer.memoryStorage() });

app.post("/pdf/analyze", upload.single("file"), async (req, res) => {
  try {
    const dataBuffer = req.file.buffer;
    const data = await pdf(dataBuffer);
    const text = data.text;

    const extract = (regex, fallback = null) => {
      const match = text.match(regex);
      return match ? match[1].trim() : fallback;
    };

    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const fullText = lines.join(" ");

    const filename = req.file.originalname;

    const teilname = extract(/(?:Benennung|Bezeichnung)[\s:\-]*([\w\-\s\.,\(\)\/]+)/i)
                  || extract(/\b([A-ZÄÖÜa-zäöü\-\s]{4,})\b(?=\s*\d{6,})/i)
                  || extract(/\b([A-ZÄÖÜa-zäöü\-\s]{4,})\b(?=\s*Zeichnungsnummer)/i)
                  || extract(/\b([\w\-\s]+)\b(?=\s*DIN)/i)
                  || "k.A.";

    const zeichnungsnummer = extract(/Zeichnungsnummer\s*[:=]?\s*([\w\-\.\/]+)/i)
                          || extract(/Nr\.\s*([\w\-]+)/i)
                          || extract(/([\d]{6,})/)
                          || "k.A.";

    const materialRaw = extract(/Material\s*[:=]?\s*([\w\.\-\/]+)/i)
                     || extract(/Werkstoff\s*[:=]?\s*([\w\.\-\/]+)/i)
                     || extract(/(1\.[0-9]{4})/)
                     || extract(/(3\.[0-9]{4})/)
                     || "stahl";

    let material = materialRaw.toLowerCase();
    if (material.includes("aluminium") || material.includes("3.4365") || material.includes("almg")) {
      material = "aluminium";
    } else if (material.includes("1.2767")) {
      material = "werkzeugstahl";
    } else if (material.includes("1.4301") || material.includes("va") || material.includes("v2a")) {
      material = "edelstahl";
    } else {
      material = "stahl";
    }

    let dichte = 7.85;
    if (material === "aluminium") dichte = 2.7;
    if (material === "edelstahl") dichte = 7.9;
    if (material === "werkzeugstahl") dichte = 7.85;

    let durchmesser = parseFloat(extract(/ø\s*([0-9]+(?:[\.,][0-9]+)?)/i) || "0");
    let laenge = parseFloat(extract(/(\d{2,4})\s*(mm)?(?=\s*[\)]?\s*$)/i) || "0");

    if (durchmesser > 0 && laenge > 0) {
      const r = durchmesser / 2 / 10; // cm
      const h = laenge / 10; // cm
      const volumen = Math.PI * r * r * h; // cm³
      const gewicht = volumen * dichte / 1000; // kg

      const laufzeit = Math.max(1, Math.round((gewicht * 20 + 5) * 10) / 10); // grob geschätzt
      const kosten = gewicht * 2 + laufzeit * 1.2 + 10;
      const preis1 = (kosten + 30).toFixed(2);
      const preis10 = (kosten * 1.1).toFixed(2);
      const preis100 = (kosten * 0.9).toFixed(2);

      return res.json({
        teilname,
        zeichnungsnummer,
        form: "Zylinder",
        material,
        masse: `${durchmesser} x ${laenge} mm`,
        gewicht: `${gewicht.toFixed(3)} kg`,
        preis1,
        preis10,
        preis100
      });
    }

    res.json({
      teilname,
      zeichnungsnummer,
      material,
      masse: "nicht erkennbar",
      form: "k.A.",
      gewicht: "k.A.",
      preis1: "-",
      preis10: "-",
      preis100: "-"
    });

  } catch (err) {
    res.status(500).json({ error: "Fehler bei der Analyse" });
  }
});

app.listen(10000, () => console.log("🔧 Server läuft auf Port 10000"));
