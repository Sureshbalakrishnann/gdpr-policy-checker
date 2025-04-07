const fs = require("fs");
const path = require("path");
const simpleGit = require("simple-git");

// ✅ Native fetch (Node 18+)
const OPENROUTER_API_KEY = "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";
const MODEL = "openai/gpt-3.5-turbo";

// 👇 Change this to your repo
const GITHUB_REPO_URL = "https://github.com/Sureshbalakrishnann/gdpr-policy-checker.git";
const LOCAL_REPO_PATH = "./gdpr-policy-checker-clone";

// ✅ Git clone only for code (policies will be fetched via URL)
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

// ✅ Load all .js/.ts/.html/.css files recursively
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

// ✅ Call OpenRouter API with prompt
async function callOpenRouter(prompt) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://yourproject.com", // Optional
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

// ✅ Fetch and validate from GitHub raw URL
async function validatePolicyFromURL(policyURL, regionLabel) {
  const policyResponse = await fetch(policyURL);
  if (!policyResponse.ok) {
    throw new Error(`Failed to fetch ${regionLabel} policy: ${policyResponse.statusText}`);
  }

  const policyText = await policyResponse.text();
  const code = loadRepoCode();

  const prompt = `
Based on the following ${regionLabel} policy and the frontend code, determine if there are any ${regionLabel} compliance violations.
If there are, list them and describe why they are non-compliant. If not, say "Compliant".

--- ${regionLabel.toUpperCase()} POLICY ---
${policyText}

--- CODE ---
${code}
`;

  const output = await callOpenRouter(prompt);
  console.log(`\n=== ${regionLabel} Compliance Report ===\n`, output);

  if (!output.toLowerCase().includes("compliant")) {
    console.error(`❌ ${regionLabel} compliance violations found.`);
    return false;
  }

  console.log(`✅ ${regionLabel} policy compliance passed.`);
  return true;
}

// ✅ Run both checks
async function validateBothPolicies() {
  await cloneOrUpdateRepo();

  const results = await Promise.all([
    validatePolicyFromURL(
      "https://raw.githubusercontent.com/Sureshbalakrishnann/gdpr-policy-checker/gdpr-fix-branch/policies/gdpr-europe.txt",
      "Europe (GDPR)"
    ),
    validatePolicyFromURL(
      "https://raw.githubusercontent.com/Sureshbalakrishnann/gdpr-policy-checker/gdpr-fix-branch/policies/privacy-us.txt",
      "US Privacy"
    )
  ]);

  if (results.includes(false)) {
    console.error("\n🚫 One or more policies failed. Stopping pipeline.");
    process.exit(1); // ❌ Fail CI
  }

  console.log("\n🎉 All policies passed. You're good to go!");
}

validateBothPolicies();
