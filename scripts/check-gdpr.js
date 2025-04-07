const fs = require("fs");
const path = require("path");
const simpleGit = require("simple-git");

// ✅ Native fetch in Node 18+ (no need to import anything)

const OPENROUTER_API_KEY = "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"; // 🔒 Replace with your OpenRouter API key
const MODEL = "openai/gpt-3.5-turbo";
const GITHUB_REPO_URL = "https://github.com/Sureshbalakrishnann/gdpr-policy-checker.git";
const LOCAL_REPO_PATH = "./gdpr-policy-checker-clone";

async function cloneOrUpdateRepo() {
  if (fs.existsSync(LOCAL_REPO_PATH)) {
    console.log("📥 Pulling latest changes...");
    const git = simpleGit(LOCAL_REPO_PATH);
    await git.pull();
  } else {
    console.log("📦 Cloning repo...");
    await simpleGit().clone(GITHUB_REPO_URL, LOCAL_REPO_PATH);
  }
}

function loadGDPRText() {
  const gdprPath = path.join(LOCAL_REPO_PATH, "gdpr-policy.txt");
  return fs.readFileSync(gdprPath, "utf-8");
}

function loadRepoCode() {
  const targetFolder = path.join(LOCAL_REPO_PATH, "gdpr-frontend");

  function readAllFiles(dir) {
    let code = "";
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        code += readAllFiles(fullPath);
      } else if (entry.isFile() && /\.(js|ts|jsx|tsx|html|css)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        code += `\n\n// --- File: ${fullPath} ---\n${content}`;
      }
    }
    return code;
  }

  return readAllFiles(targetFolder);
}

async function callOpenRouter(prompt) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://yourproject.com",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error ${response.status}: ${response.statusText}\nDetails: ${errorBody}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "No response content.";
}

async function validateGDPR() {
  await cloneOrUpdateRepo();

  const gdprText = loadGDPRText();
  const code = loadRepoCode();

  const prompt = `
Based on the following GDPR policy document and the frontend code below, determine if there are any GDPR compliance violations.
If there are, list them and describe why they are non-compliant. If not, say "Compliant".

--- GDPR POLICY ---
${gdprText}

--- CODE ---
${code}
`;

  const output = await callOpenRouter(prompt);
  console.log("=== GDPR Compliance Report ===\n", output);

  if (!output.toLowerCase().includes("compliant")) {
    console.error("❌ GDPR violations found. Aborting process.");
    process.exit(1);
  } else {
    console.log("✅ No GDPR violations found.");
  }
}

validateGDPR();
