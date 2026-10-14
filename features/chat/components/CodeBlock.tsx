"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

type Props = {
  language?: string;
  children: ReactNode;
};

export function CodeBlock({ language = "text", children }: Props) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, "");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="my-3 min-w-0 overflow-hidden rounded-lg">
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2 text-xs text-gray-200">
        <span>{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          arial-label="Copiar código"
          className="flex items-center gap-2 houver:text-white"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        PreTag="div"
        customStyle={{ margin: 0, padding: "1rem" }}
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
