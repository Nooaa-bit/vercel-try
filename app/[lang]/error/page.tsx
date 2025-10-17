"use client";

import { useSearchParams } from "next/navigation";

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message") || "Something went wrong";

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>❌ Oops!</h1>
      <p>{message}</p>
      <a href="/">Go Home</a>
    </div>
  );
}
