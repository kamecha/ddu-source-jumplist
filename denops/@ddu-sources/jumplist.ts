import { Denops } from "https://deno.land/x/ddu_vim@v2.2.0/deps.ts";
import { BaseSource, Item } from "https://deno.land/x/ddu_vim@v2.2.0/types.ts";
import { ActionData } from "https://deno.land/x/ddu_kind_file@v0.3.2/file.ts";
import {
  bufexists,
  bufname,
  getbufline,
  getjumplist,
  has,
} from "https://deno.land/x/denops_std@v4.1.5/function/mod.ts";
import * as z from "https://deno.land/x/zod@v3.16.1/mod.ts";

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
        const originalJumpList = await getjumplist(
          args.denops,
          args.sourceParams.winnr === 0 ? undefined : args.sourceParams.winnr,
          args.sourceParams.tabnr === 0 ? undefined : args.sourceParams.tabnr,
        );
        try {
          const jumpList = JumpSchema.parse(originalJumpList);
          const items: Item<ActionData>[] = [];
          for (const jump of jumpList[0]) {
            if (!await bufexists(args.denops, jump.bufnr)) {
              continue;
            }
            if (
              await has(args.denops, "nvim") &&
              await args.denops.call("nvim_buf_is_valid", jump.bufnr) === false
            ) {
              continue;
            }
            const line = await getbufline(args.denops, jump.bufnr, jump.lnum);
            const bufName = await bufname(args.denops, jump.bufnr);
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
