// app/lib/clientMap.ts
import { docMap } from "@/app/lib/docMap";

export type ClientEntry = {
  displayName: string;
  slugKeys: Array<keyof typeof docMap>;
  description?: string;
  clientAgentId?: string;
};






