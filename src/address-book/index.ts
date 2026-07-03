import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isAddress, type Address } from "viem";

export type AddressBookEntry = {
  name: string;
  address: Address;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

type AddressBookFile = {
  entries: Record<string, AddressBookEntry>;
};

export type AddressBook = {
  list: () => AddressBookEntry[];
  get: (name: string) => AddressBookEntry | undefined;
  resolve: (value: string) => Address | undefined;
  add: (input: { name: string; address: string; note?: string }) => AddressBookEntry;
  update: (name: string, input: { address?: string; note?: string }) => AddressBookEntry;
  remove: (name: string) => AddressBookEntry;
};

export function createAddressBook(filePath = ".wallet-address-book.json"): AddressBook {
  const fullPath = resolve(process.cwd(), filePath);

  function load(): AddressBookFile {
    if (!existsSync(fullPath)) {
      return { entries: {} };
    }

    const data = JSON.parse(readFileSync(fullPath, "utf8")) as AddressBookFile;
    return { entries: data.entries ?? {} };
  }

  function save(data: AddressBookFile) {
    writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`);
  }

  return {
    list() {
      return Object.values(load().entries).sort((a, b) => a.name.localeCompare(b.name));
    },
    get(name) {
      return load().entries[toKey(name)];
    },
    resolve(value) {
      if (isAddress(value)) {
        return value;
      }

      return load().entries[toKey(value)]?.address;
    },
    add(input) {
      const name = normalizeName(input.name);
      const key = toKey(name);
      const address = normalizeAddress(input.address);
      const data = load();
      if (data.entries[key]) {
        throw new Error(`Address book entry "${name}" already exists`);
      }

      const now = new Date().toISOString();
      const entry: AddressBookEntry = {
        name,
        address,
        note: normalizeOptionalText(input.note),
        createdAt: now,
        updatedAt: now
      };
      data.entries[key] = entry;
      save(data);
      return entry;
    },
    update(name, input) {
      const key = toKey(name);
      const data = load();
      const existing = data.entries[key];
      if (!existing) {
        throw new Error(`Address book entry "${name}" does not exist`);
      }

      const updated: AddressBookEntry = {
        ...existing,
        address: input.address !== undefined ? normalizeAddress(input.address) : existing.address,
        note: input.note !== undefined ? normalizeOptionalText(input.note) : existing.note,
        updatedAt: new Date().toISOString()
      };
      data.entries[key] = updated;
      save(data);
      return updated;
    },
    remove(name) {
      const key = toKey(name);
      const data = load();
      const existing = data.entries[key];
      if (!existing) {
        throw new Error(`Address book entry "${name}" does not exist`);
      }

      delete data.entries[key];
      save(data);
      return existing;
    }
  };
}

function normalizeName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("Address book name is required");
  }
  return normalized;
}

function toKey(name: string): string {
  return normalizeName(name).toLowerCase();
}

function normalizeAddress(address: string): Address {
  if (!isAddress(address)) {
    throw new Error("Invalid EVM address");
  }
  return address;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
