import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Secure API endpoint for Gemini-powered clinical symptom summary
app.post('/api/symptom-summary', async (req, res) => {
  try {
    const {
      patientIdentifier,
      age,
      ageUnit,
      sex,
      language,
      symptoms,
      duration,
      temperature,
      notes
    } = req.body;

    if (!symptoms || !symptoms.trim()) {
      return res.status(400).json({ error: 'Symptoms description is required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server. Falling back to local rule-based engine.',
        isFallback: true
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `You are a clinical decision-support assistant designed to assist community health workers (CHEWs) and nurses at rural Primary Healthcare Centres in Akwa Ibom State, Nigeria.

Analyze this fictional patient intake:
- Patient Reference: ${patientIdentifier || 'Patient'}
- Demographics: Age ${age} ${ageUnit}, Sex: ${sex}
- Primary Intake Language: ${language}
- Reported Symptoms (Verbatim): "${symptoms}"
- Reported Duration: ${duration || 'Not specified'}
- Measured Temperature: ${temperature ? `${temperature}°C` : 'Not recorded'}
- Additional Nurse Observations: ${notes || 'None'}

STRICT CLINICAL DECISION-SUPPORT CONSTRAINTS:
1. Organize the reported symptoms and timeline into clear, concise clinical categories without inventing symptoms.
2. Highlight potential warning signs ONLY when directly supported by the entered data (e.g. high fever >= 38.5C, respiratory difficulty/chest indrawing, inability to retain oral fluids/vomiting, signs of lethargy or convulsion, or prolonged duration > 7 days).
3. Identify missing information that the health worker should actively verify or collect (e.g. hydration assessment, respiratory rate, immunization card, recent antimalarial intake, convulsion history).
4. DO NOT diagnose diseases (do NOT declare "The patient has pneumonia" or "Diagnosis: Malaria"). Frame as "Reported signs consistent with acute febrile presentation" or "Respiratory symptoms requiring physical examination".
5. DO NOT prescribe medications, dosages, or drug regimens.
6. Highlight appropriate standard primary healthcare operating actions (e.g. perform rapid diagnostic test RDT for malaria per national guidelines, check vital signs, assess hydration status, or refer to General Hospital if danger signs are present).
7. Determine warningLevel as strictly one of: "red" (acute danger signs), "yellow" (moderate concern / monitoring), or "green" (routine observation).

Respond ONLY with a valid JSON object matching this schema:
{
  "warningLevel": "red" | "yellow" | "green",
  "warningSigns": ["string"],
  "chiefComplaints": ["string"],
  "durationSummary": "string",
  "temperatureStatus": "string",
  "missingInformation": ["string"],
  "clinicalConsiderations": ["string"],
  "suggestedActions": ["string"]
}`;

    let text: string | undefined;
    let modelUsed = 'gemini-3.1-flash-lite';
    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

    for (const m of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
        if (response.text) {
          text = response.text;
          modelUsed = m;
          break;
        }
      } catch (err: any) {
        console.warn(`Model ${m} error:`, err?.message);
      }
    }

    if (!text) {
      throw new Error('Gemini API returned an empty response.');
    }

    const parsedData = JSON.parse(text);

    return res.json({
      success: true,
      isAiGenerated: true,
      modelUsed,
      data: parsedData
    });
  } catch (error: any) {
    console.error('Gemini symptom summary error:', error);
    return res.status(500).json({
      error: error?.message || 'Server error while generating Gemini symptom summary.',
      isFallback: true
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IbomCare AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
