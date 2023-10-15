import type { ActionData, Denops, Item } from "../deps.ts";
import { BaseSource, fn, z } from "../deps.ts";

type Params = {
  winnr: number;
  tabnr: number;
};

const JumpSchema = z.tuple([
  z.array(
    z.object({
      bufnr: z.number(),
      col: z.number(),
      coladd: z.number(),
      filename: z.string().optional(),
      lnum: z.number(),
    }),
  ),
  z.number(),
]);

export class Source extends BaseSource<Params> {
  kind = "file";

  gather(args: {
    denops: Denops;
    sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]> {
    return new ReadableStream({
      async start(controller) {
        const originalJumpList = await fn.getjumplist(
          args.denops,
          args.sourceParams.winnr === 0 ? undefined : args.sourceParams.winnr,
          args.sourceParams.tabnr === 0 ? undefined : args.sourceParams.tabnr,
        );
        try {
          const jumpList = JumpSchema.parse(originalJumpList);
          const items: Item<ActionData>[] = [];
          for (const jump of jumpList[0]) {
            if (!await fn.bufexists(args.denops, jump.bufnr)) {
              continue;
            }
            if (
              await fn.has(args.denops, "nvim") &&
              await args.denops.call("nvim_buf_is_valid", jump.bufnr) === false
            ) {
              continue;
            }
            const line = await fn.getbufline(
              args.denops,
              jump.bufnr,
              jump.lnum,
            );
            const bufName = await fn.bufname(args.denops, jump.bufnr);
            items.push({
              word: bufName + ":" + jump.lnum + ":" + jump.col +
                "\t" + (line[0] ?? ""),
              action: {
                bufNr: jump.bufnr,
                col: jump.col,
                lineNr: jump.lnum,
              },
            });
          }
          controller.enqueue(items);
          controller.close();
        } catch (err) {
          console.log(err);
          return;
        }
      },
    });
  }

  params(): Params {
    return {
      winnr: 0,
      tabnr: 0,
    };
  }
}
