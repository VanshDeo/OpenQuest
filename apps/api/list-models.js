const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: "/Users/vanshdeo/dev/git-master/apps/api/.env" });

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log(data.models.map(m => m.name).filter(n => n.includes("1.5-flash")));
}
run();
