"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatNumberWithDots, parseCurrencyInput } from "@/utils";
import { cn } from "@/lib/utils";

interface MoneyInputProps {
  value: number | string;
  onValueChange: (numericValue: number) => void;
  currency?: string;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

export function MoneyInput({
  value,
  onValueChange,
  currency = "IDR",
  placeholder = "0",
  className,
  id,
  disabled,
}: MoneyInputProps) {
  const displayValue = formatNumberWithDots(value, currency);
  const symbol = currency === "USD" ? "$" : "Rp";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawVal = e.target.value;
    const numeric = parseCurrencyInput(rawVal);
    onValueChange(numeric);
  }

  return (
    <div className="relative flex items-center">
      <span className="absolute left-3 text-xs font-semibold text-muted-foreground pointer-events-none">
        {symbol}
      </span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        className={cn("pl-9 font-medium tracking-tight", className)}
      />
    </div>
  );
}
