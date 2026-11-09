import { NextResponse } from "next/server";
import { guard, conflict } from "@/lib/adminHttp";
import { shipment } from "@/lib/international/fulfillment";
import {
  prepareFullShiprocketShipment,
  generateShippingLabel,
  requestCourierPickup,
  trackShipment,
  getShiprocketConfig,
} from "@/lib/shiprocket";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const config = getShiprocketConfig();
  try {
    const s = shipment(id);
    if (!s || !s.document || s.document === "{}") {
      return NextResponse.json({
        shipment: null,
        mode: config.mode,
        orderCreationMode: config.orderCreationMode,
      });
    }
    const data = JSON.parse(s.document);
    return NextResponse.json({
      mode: config.mode,
      orderCreationMode: config.orderCreationMode,
      shipment: {
        orderId: s.order_id,
        status: s.status,
        shiprocketOrderId: data.order_id,
        shipmentId: data.shipment_id,
        courierId: data.courierId,
        awbCode: data.awb?.awb_code,
        courierName: data.awb?.courier_name,
        labelUrl: data.label?.label_url,
        pickupToken: data.pickup?.pickup_token_number,
        pickupDate: data.pickup?.pickup_scheduled_date,
        publicTracking: data.publicTracking,
        updatedAt: s.updated_ms,
      },
    });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to load shipment.");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
  };

  const action = body.action || "prepare_full";

  try {
    if (action === "prepare_full") {
      const result = await prepareFullShiprocketShipment(id, "admin");
      return NextResponse.json({ ok: true, shipment: result });
    }

    const s = shipment(id);
    if (!s || !s.document || s.document === "{}") {
      throw new Error("Shipment has not been created yet. Please run full preparation.");
    }
    const data = JSON.parse(s.document);
    const shipmentId = Number(data.shipment_id);

    if (action === "label") {
      const labelRes = await generateShippingLabel(shipmentId);
      return NextResponse.json({ ok: true, label: labelRes });
    }

    if (action === "pickup") {
      const pickupRes = await requestCourierPickup(shipmentId);
      return NextResponse.json({ ok: true, pickup: pickupRes });
    }

    if (action === "track") {
      const trackRes = await trackShipment(shipmentId);
      return NextResponse.json({ ok: true, tracking: trackRes });
    }

    throw new Error(`Unknown dispatch action: ${action}`);
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Shiprocket dispatch action failed.");
  }
}
