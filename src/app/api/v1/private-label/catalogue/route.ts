import { NextResponse } from "next/server";
import { PrivateLabelService } from "@/lib/private-label/service";
import { publicCatalogueQuerySchema } from "@/lib/private-label/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const parsed = publicCatalogueQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid catalogue query parameters",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = PrivateLabelService.listPublicPackagingVariants(parsed.data);

    // Support ?type=print_methods directly
    if (parsed.data.type === "print_methods") {
      return NextResponse.json(
        {
          items: result.print_methods,
          print_methods: result.print_methods,
          total: result.print_methods.length,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
