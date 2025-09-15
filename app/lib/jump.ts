// app/lib/jump.ts
export function slugify(s: string) {
  return s.toLowerCase().replace(/[^\w\s-]/g,"").trim().replace(/\s+/g,"-");
}

export function jumpToHeading(headingTextOrId: string) {
  const id = document.getElementById(headingTextOrId)
    ? headingTextOrId
    : slugify(headingTextOrId);
  const el = document.getElementById(id) ||
             Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
               .find(h => (h as HTMLElement).innerText.trim().toLowerCase() === headingTextOrId.trim().toLowerCase());
  if (el) (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
}