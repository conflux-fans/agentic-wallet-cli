export type Logger = {
  verbose: boolean;
  log: (message: string, data?: Record<string, unknown>) => void;
};

export function createLogger(verbose: boolean): Logger {
  return {
    verbose,
    log(message, data) {
      if (!verbose) {
        return;
      }

      const suffix = data ? ` ${stringifyLogData(data)}` : "";
      console.error(`[verbose] ${message}${suffix}`);
    }
  };
}

function stringifyLogData(data: Record<string, unknown>): string {
  return JSON.stringify(data, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}
