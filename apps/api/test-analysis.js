const { Octokit } = require("@octokit/rest");
require("dotenv").config({ path: "/Users/vanshdeo/dev/git-master/apps/api/.env" });

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not found in .env");

  const prompt = `Test prompt return JSON {"test": "success"}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
  
  try {
     const res = await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
             contents: [{ parts: [{ text: prompt }] }],
             generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
         }),
     });
     const text = await res.text();
     console.log("Status:", res.status);
     console.log("Response:", text.slice(0, 500));
  } catch(e) {
     console.error("Fetch err:", e);
  }
}
run();
