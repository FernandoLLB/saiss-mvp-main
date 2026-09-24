"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function BotonEnviar({
  children,
  className = "",
  pendiente,
  ...props
}: { children: ReactNode; className?: string; pendiente?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button {...props} disabled={pending || props.disabled} className={`rounded-lg px-3 py-1.5 text-sm font-bold disabled:opacity-50 ${className}`}>
      {pending && pendiente ? pendiente : children}
    </button>
  );
}
