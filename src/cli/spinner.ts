export type Spinner = {
  start: () => void;
  stop: () => void;
};

export function createSpinner(text: string, enabled: boolean): Spinner {
  const frames = ["-", "\\", "|", "/"];
  let index = 0;
  let timer: NodeJS.Timeout | undefined;

  function render() {
    const frame = frames[index % frames.length];
    index += 1;
    process.stderr.write(`\r${frame} ${text}`);
  }

  return {
    start() {
      if (!enabled || timer) {
        return;
      }

      render();
      timer = setInterval(render, 120);
    },
    stop() {
      if (!timer) {
        return;
      }

      clearInterval(timer);
      timer = undefined;
      process.stderr.write(`\r${" ".repeat(text.length + 2)}\r`);
    }
  };
}
