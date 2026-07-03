import { tool } from "ai";
import { z } from "zod";
import type { AddressBook } from "../../address-book/index.js";
import type { Logger } from "../../logger.js";

export function createAddressBookTools(addressBook: AddressBook, logger: Logger) {
  return {
    listAddressBookEntries: tool({
      description: "查询地址簿中的全部联系人。",
      inputSchema: z.object({}),
      execute: async () => {
        logger.log("agent tool call", { tool: "listAddressBookEntries", input: {} });
        return addressBook.list();
      }
    }),
    getAddressBookEntry: tool({
      description: "根据联系人名称查询地址簿中的 EVM 地址。",
      inputSchema: z.object({
        name: z.string().describe("联系人名称")
      }),
      execute: async ({ name }) => {
        logger.log("agent tool call", { tool: "getAddressBookEntry", input: { name } });
        const entry = addressBook.get(name);
        if (!entry) {
          throw new Error(`地址簿中没有联系人 "${name}"`);
        }
        return entry;
      }
    }),
    addAddressBookEntry: tool({
      description: "向地址簿增加联系人名称和 EVM 地址。",
      inputSchema: z.object({
        name: z.string().describe("联系人名称"),
        address: z.string().describe("联系人 EVM 地址"),
        note: z.string().optional().describe("备注")
      }),
      execute: async ({ name, address, note }) => {
        logger.log("agent tool call", { tool: "addAddressBookEntry", input: { name, address, note } });
        return addressBook.add({ name, address, note });
      }
    }),
    updateAddressBookEntry: tool({
      description: "修改地址簿联系人地址或备注。",
      inputSchema: z.object({
        name: z.string().describe("联系人名称"),
        address: z.string().optional().describe("新的 EVM 地址"),
        note: z.string().optional().describe("新的备注")
      }),
      execute: async ({ name, address, note }) => {
        logger.log("agent tool call", { tool: "updateAddressBookEntry", input: { name, address, note } });
        return addressBook.update(name, { address, note });
      }
    }),
    removeAddressBookEntry: tool({
      description: "从地址簿删除联系人。",
      inputSchema: z.object({
        name: z.string().describe("联系人名称")
      }),
      execute: async ({ name }) => {
        logger.log("agent tool call", { tool: "removeAddressBookEntry", input: { name } });
        return addressBook.remove(name);
      }
    })
  };
}
