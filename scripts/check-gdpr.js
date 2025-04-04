const fs = require("fs");
const fetch = require("node-fetch");

const OPENROUTER_API_KEY = "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";
const MODEL = "openai/gpt-3.5-turbo"; // You can change this if needed

async function loadGDPRText() {
  return fs.readFileSync("gdpr-policy.txt", "utf-8");
}

function loadRepoCode() {
  const files = fs.readdirSync("./", { withFileTypes: true });
  return files
    .filter(f => f.isFile() && f.name.endsWith(".js"))
    .map(f => fs.readFileSync(f.name, "utf-8"))
    .join("\n");
}

async function callOpenRouter(prompt) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://yourproject.com", // Replace with your actual project domain if available
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const result = await response.json();
  return result.choices?.[0]?.message?.content || JSON.stringify(result);
}

async function validateGDPR() {
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

  const output = await callOpenRouter(prompt);
  console.log("=== GDPR Compliance Report ===\n", output);

  if (!output.includes("Compliant")) {
    console.error("GDPR violations found. Aborting commit.");
    process.exit(1);
  }
}

validateGDPR();
