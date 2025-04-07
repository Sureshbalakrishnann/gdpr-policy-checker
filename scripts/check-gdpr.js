const fs = require("fs");
const path = require("path");
const simpleGit = require("simple-git");

// ✅ OpenRouter API Key and Model
const OPENROUTER_API_KEY = "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";
const MODEL = "openai/gpt-3.5-turbo";

// ✅ Repo details
const GITHUB_REPO_URL = "https://github.com/Sureshbalakrishnann/gdpr-policy-checker.git";
const LOCAL_REPO_PATH = "./gdpr-policy-checker-clone";

// ✅ Clone or pull latest code from main branch
async function cloneOrUpdateRepo() {
  const git = simpleGit();

  if (fs.existsSync(LOCAL_REPO_PATH)) {
    console.log("📥 Pulling latest changes...");
    const repo = simpleGit(LOCAL_REPO_PATH);
    await repo.fetch();
    await repo.checkout("gdpr-fix-branch");
    await repo.pull("origin", "gdpr-fix-branch");
  } else {
    console.log("📦 Cloning repo...");
    await git.clone(GITHUB_REPO_URL, LOCAL_REPO_PATH, ["--branch=gdpr-fix-branch"]);
  }
}

// ✅ Recursively load source code files
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

// ✅ Load policy and compare with code
async function validatePolicyFromURL(policyURL, regionLabel) {
  const policyResponse = await fetch(policyURL);
  if (!policyResponse.ok) {
    throw new Error(`Failed to fetch ${regionLabel} policy: ${policyResponse.statusText}`);
  }

  const policyText = await policyResponse.text();
  const code = loadRepoCode();

  const prompt = `
Based on the following ${regionLabel} policy and the frontend code, determine if there are any ${regionLabel} compliance violations.
If there are, list them and describe why they are non-compliant.
If everything is compliant, reply with exactly: "Compliant" (without quotes and no other text).

--- ${regionLabel.toUpperCase()} POLICY ---
${policyText}

--- CODE ---
${code}
`;

  const output = await callOpenRouter(prompt);
  console.log(`\n=== ${regionLabel} Compliance Report ===\n`, output);

  const cleaned = output.trim().toLowerCase();
  const passed = cleaned === "compliant";

  if (passed) {
    console.log(`✅ ${regionLabel} policy compliance passed.`);
    return true;
  } else {
    console.error(`❌ ${regionLabel} compliance violations found.`);
    return false;
  }
}

// ✅ Validate both policies
async function validateBothPolicies() {
  await cloneOrUpdateRepo();

  const results = await Promise.all([
    validatePolicyFromURL(
      "https://raw.githubusercontent.com/Sureshbalakrishnann/gdpr-policy-checker/gdpr-fix-branch/policies/gdpr-europe.txt",
      "Europe (GDPR)"
    ),
    validatePolicyFromURL(
      "https://raw.githubusercontent.com/Sureshbalakrishnann/gdpr-policy-checker/gdpr-fix-branch/policies/gdpr-us.txt",
      "US Privacy"
    ),
  ]);

  if (results.includes(false)) {
    console.error("\n🚫 One or more policies failed. Stopping pipeline.");
    process.exit(1); // ❌ Fail CI
  }

  console.log("\n🎉 All policies passed. You're good to go!");
}

validateBothPolicies();
