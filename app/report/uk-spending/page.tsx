import fs from "fs";
import path from "path";
import ReportClient from "./report-client";

export default function Page() {
  const filePath = path.join(process.cwd(), "public/reports/uk_spending_full.html");
  let html = "<p style='color:red'>Report not found</p>";

  if (fs.existsSync(filePath)) {
    html = fs.readFileSync(filePath, "utf-8");
  }

  return <ReportClient combinedHtml={html} />;
}