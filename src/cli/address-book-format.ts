import type { AddressBookEntry } from "../address-book/index.js";

export function formatAddressBookEntry(entry: AddressBookEntry): string {
  return [
    `名称：${entry.name}`,
    `地址：${entry.address}`,
    ...(entry.note ? [`备注：${entry.note}`] : []),
    `创建时间：${entry.createdAt}`,
    `更新时间：${entry.updatedAt}`
  ].join("\n");
}

export function formatAddressBookList(entries: AddressBookEntry[]): string {
  if (entries.length === 0) {
    return "地址簿为空。";
  }

  return entries
    .map((entry) =>
      [`名称：${entry.name}`, `地址：${entry.address}`, ...(entry.note ? [`备注：${entry.note}`] : [])].join("\n")
    )
    .join("\n\n");
}
