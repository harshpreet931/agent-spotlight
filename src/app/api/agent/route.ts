import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

export async function POST(req: NextRequest) {
  try {
    const { query, tools, history, apiKey } = await req.json();

    // Debug logs - only in development to prevent sensitive data exposure
    if (process.env.NODE_ENV === 'development') {
      console.log("Query:", query);
      console.log("Tools received:", JSON.stringify(tools, null, 2));
      console.log("History length:", history?.length || 0);
    }

    const key = apiKey || process.env.GOOGLE_API_KEY || "";
    if (!key) {
      return NextResponse.json({ error: "API key is missing" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      safetySettings,
    });

    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const chat = model.startChat({
      tools: tools || [],
      history: history || [],
    });

    const result = await chat.sendMessage(query);
    const response = await result.response;
    const functionCalls = response.functionCalls();
    const text = response.text();

    // Debug logs - only in development to prevent sensitive data exposure
    if (process.env.NODE_ENV === 'development') {
      console.log("Function calls:", functionCalls);
      console.log("Response text:", text);
    }

    if (functionCalls && functionCalls.length > 0) {
      return NextResponse.json({
        type: "tool_call",
        tool_calls: functionCalls,
      });
    }

    return NextResponse.json({ type: "text", response: text });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
