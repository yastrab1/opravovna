import { Worker } from "node:worker_threads";
import { randomUUID } from "node:crypto";
export class RenderPool {
  constructor(size) {
    this.slots = Array.from({ length: size }, () => ({
      worker: null,
      task: null,
    }));
    this.queue = [];
  }
  run(bytes, state) {
    return new Promise((resolve, reject) => {
      this.queue.push({ id: randomUUID(), bytes, state, resolve, reject });
      this.dispatch();
    });
  }
  dispatch() {
    for (const slot of this.slots) {
      if (slot.task || !this.queue.length) continue;
      if (!slot.worker) {
        const worker = (slot.worker = new Worker(
          new URL("./pdf-worker.mjs", import.meta.url),
        ));
        const fail = (error) => {
          if (slot.worker !== worker) return;
          clearTimeout(slot.timer);
          slot.worker = null;
          slot.task?.reject(error);
          slot.task = null;
          void worker.terminate();
          this.dispatch();
        };
        worker.on("error", fail);
        worker.on("exit", () =>
          fail(
            new Error("Exportný proces bol prerušený. Skúste export znova."),
          ),
        );
        worker.on("message", (result) => {
          if (!slot.task || result.id !== slot.task.id) return;
          clearTimeout(slot.timer);
          const task = slot.task;
          slot.task = null;
          if (result.error) task.reject(new Error(result.error));
          else task.resolve(result.bytes);
          this.dispatch();
        });
      }
      slot.task = this.queue.shift();
      slot.timer = setTimeout(() => {
        const task = slot.task;
        slot.task = null;
        const worker = slot.worker;
        slot.worker = null;
        task.reject(
          new Error("Export PDF trvá príliš dlho. Skúste export znova."),
        );
        void worker.terminate();
        this.dispatch();
      }, 180_000);
      const { id, bytes, state } = slot.task;
      slot.worker.postMessage({ id, bytes, state }, [bytes.buffer]);
    }
  }
  async close() {
    for (const task of this.queue.splice(0))
      task.reject(new Error("Server sa reštartuje."));
    await Promise.all(
      this.slots.map(async (slot) => {
        clearTimeout(slot.timer);
        slot.task?.reject(new Error("Server sa reštartuje."));
        slot.task = null;
        const worker = slot.worker;
        slot.worker = null;
        await worker?.terminate();
      }),
    );
  }
}
