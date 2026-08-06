import { NextRequest, NextResponse } from "next/server";
import { bot } from "@/server/telegram/bot";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Verify secret token from Telegram
    const secret = req.headers.get("x-telegram-bot-api-secret-token");
    if (secret && process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.warn("Telegram secret mismatch:", { secret, expected: process.env.TELEGRAM_WEBHOOK_SECRET });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!bot.isInited()) {
      await bot.init();
    }

    // Process update via grammY
    await bot.handleUpdate(body);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
