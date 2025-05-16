
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const pdf = require("pdf-parse");

const app = express();
app.use(cors());
const upload = multer({ storage: multer.memoryStorage() });

app.post("/pdf/analyze", upload.single("file"), async (req, res) => {
  try {
    const buffer = req.file.buffer;
    const data = await pdf(buffer);
    const text = data.text.replace(/\n/g, " ");
    const extract = (pattern, fallback = null) => {
      const match = text.match(pattern);
      return match && match[1] ? match[1].trim() : fallback;
    };

    // Teilename z. B. "Konturplatte 89x58x12,8"
    const teilname = extract(/Benennung\s*[:=]?\s*([\w\-\s\.,]+)/i)
                  || extract(/Konturplatte\s*([\d\sxX\.,]+)/i)
                  || "k.A.";

    // Zeichnungsnummer: 7-stellige oder alphanumerische
    const zeichnungsnummer = extract(/Zeichnungsnummer\s*[:=]?\s*(\w{6,})/i)
                          || extract(/(A\d{6,})/i)
                          || extract(/\b(7\d{6})\b/, "k.A.");

    // Material
    const materialRaw = extract(/Material\s*[:=]?\s*([\w\.\-\/]+)/i)
                     || extract(/Werkstoff\s*[:=]?\s*([\w\.\-\/]+)/i)
                     || extract(/(1\.[0-9]{4})/)
                     || extract(/(3\.[0-9]{4})/)
                     || "stahl";

    let material = materialRaw.toLowerCase();
    let dichte = 7.85;
    if (material.includes("alu") || material.includes("3.4365") || material.includes("almg")) {
      material = "aluminium"; dichte = 2.7;
    } else if (material.includes("edelstahl") || material.includes("1.4301")) {
      material = "edelstahl"; dichte = 7.9;
    } else if (material.includes("1.2767")) {
      material = "werkzeugstahl"; dichte = 7.85;
    }

    // Maße z. B. "89 x 58 x 12,8"
    let masse = extract(/(\d{2,4})\s?[xX*]\s?(\d{2,4})\s?[xX*]\s?(\d{1,3}[\.,]\d{1,3})/);
    let form = "k.A.";
    let gewicht = "k.A.";
    let preis1 = "-", preis10 = "-", preis100 = "-";

    if (masse) {
      const match = masse.match(/(\d{2,4})\s?[xX*]\s?(\d{2,4})\s?[xX*]\s?(\d{1,3}[\.,]\d{1,3})/);
      const [a, b, c] = [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3].replace(",", "."))];
      const volumen_cm3 = (a * b * c); // mm³
      const gewicht_kg = (volumen_cm3 / 1000) * dichte / 1000; // in kg
      gewicht = gewicht_kg.toFixed(3) + " kg";
      form = "Platte";

      const laufzeit = Math.max(1, gewicht_kg * 20 + 5); // grob
      const rohmaterial = gewicht_kg * 1.5;
      const kosten = rohmaterial + laufzeit * 0.75 + 30;

      preis1 = (kosten * 1.2).toFixed(2) + " €";
      preis10 = (kosten * 1.1).toFixed(2) + " €";
      preis100 = (kosten * 0.9).toFixed(2) + " €";
    }

    res.json({
      teilname,
      zeichnungsnummer,
      material,
      masse: masse || "nicht erkannt",
      form,
      gewicht,
      preis1,
      preis10,
      preis100
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysefehler" });
  }
});

app.listen(10000, () => console.log("✅ Backend V6 läuft auf Port 10000"));
