const fs = require("fs");
const pdfParse = require("pdf-parse");
const { OpenAI } = require("openai");

async function loadGDPRText() {
  const buffer = fs.readFileSync("gdpr-policies.pdf");
  const data = await pdfParse(buffer);
  return data.text;
}

function loadRepoCode() {
  const files = fs.readdirSync("./", { withFileTypes: true });
  return files
    .filter(f => f.isFile() && f.name.endsWith(".js"))
    .map(f => fs.readFileSync(f.name, "utf-8"))
    .join("\n");
}

async function validateGDPR() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const gdprText = await loadGDPRText();
  const code = loadRepoCode();

  const prompt = `
Based on the following GDPR policy document and the code below, determine if there are any GDPR compliance violations. 

If there are, list them and describe why they are non-compliant. If not, say "Compliant".

--- GDPR POLICY ---
${gdprText}

--- CODE ---
${code}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });

  const output = response.choices[0].message.content;
  console.log("=== GDPR Compliance Report ===\n", output);

  if (!output.includes("Compliant")) {
    console.error("GDPR violations found. Aborting commit.");
    process.exit(1);
  }
}

validateGDPR();
