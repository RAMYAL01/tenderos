import { Webhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { MemberRole } from "@prisma/client";
import { slugify } from "@/lib/utils";

/**
 * Clerk Webhook Handler
 *
 * Syncs Clerk organization and membership events to our PostgreSQL database.
 * Every Clerk event is verified via the svix signature before processing.
 *
 * Events handled:
 * - organization.created     → create Organization
 * - organization.updated     → update Organization
 * - organization.deleted     → soft-delete Organization
 * - organizationMembership.created  → upsert Member
 * - organizationMembership.updated  → update Member role
 * - organizationMembership.deleted  → deactivate Member
 * - user.updated             → sync name/avatar changes
 *
 * Setup in Clerk Dashboard:
 * 1. Go to Webhooks → Add Endpoint
 * 2. URL: https://your-domain.com/api/webhooks/clerk
 * 3. Events: organization.*, organizationMembership.*, user.*
 * 4. Copy the Signing Secret → CLERK_WEBHOOK_SECRET env var
 */
export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not configured");
    return new Response("Server configuration error", { status: 500 });
  }

  // ── Verify svix signature ──────────────────────────────────────────────────
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing required svix headers", { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Clerk webhook verification failed:", err);
    return new Response("Webhook verification failed", { status: 400 });
  }

  // ── Route to handler ────────────────────────────────────────────────────────
  try {
    switch (evt.type) {
      case "organization.created":
        await handleOrgCreated(evt.data);
        break;

      case "organization.updated":
        await handleOrgUpdated(evt.data);
        break;

      case "organization.deleted":
        await handleOrgDeleted(evt.data);
        break;

      case "organizationMembership.created":
        await handleMembershipCreated(evt.data);
        break;

      case "organizationMembership.updated":
        await handleMembershipUpdated(evt.data);
        break;

      case "organizationMembership.deleted":
        await handleMembershipDeleted(evt.data);
        break;

      case "user.updated":
        await handleUserUpdated(evt.data);
        break;

      default:
        // Unknown event type — log and return 200 so Clerk doesn't retry
        console.log(`Unhandled Clerk event: ${evt.type}`);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error(`Error processing Clerk event ${evt.type}:`, err);
    // Return 500 so Clerk retries the event
    return new Response("Internal server error", { status: 500 });
  }
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleOrgCreated(data: {
  id: string;
  name: string;
  slug: string | null;
  image_url?: string | null;
}) {
  const slug = data.slug ?? slugify(data.name) ?? data.id;

  await db.organization.create({
    data: {
      clerkOrgId: data.id,
      name: data.name,
      slug,
      logoUrl: data.image_url ?? null,
      isActive: true,
    },
  });

  console.log(`Organization created: ${data.id} (${data.name})`);
}

async function handleOrgUpdated(data: {
  id: string;
  name: string;
  slug: string | null;
  image_url?: string | null;
}) {
  const slug = data.slug ?? slugify(data.name) ?? data.id;

  await db.organization.updateMany({
    where: { clerkOrgId: data.id, deletedAt: null },
    data: {
      name: data.name,
      slug,
      logoUrl: data.image_url ?? null,
    },
  });

  console.log(`Organization updated: ${data.id}`);
}

async function handleOrgDeleted(data: { id?: string; deleted?: boolean }) {
  if (!data.id) return;
  await db.organization.updateMany({
    where: { clerkOrgId: data.id },
    data: {
      deletedAt: new Date(),
      isActive: false,
    },
  });

  console.log(`Organization soft-deleted: ${data.id}`);
}

async function handleMembershipCreated(data: {
  organization: { id: string; name: string; slug: string | null };
  public_user_data: {
    user_id: string;
    identifier: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };
  role: string;
}) {
  const org = await db.organization.findUnique({
    where: { clerkOrgId: data.organization.id },
  });

  if (!org) {
    // Org might not be synced yet — this can happen if events arrive out of order
    console.warn(
      `Org not found for membership created: ${data.organization.id}. ` +
      `Creating org first.`
    );
    await handleOrgCreated({
      id: data.organization.id,
      name: data.organization.name,
      slug: data.organization.slug,
    });
    return handleMembershipCreated(data); // retry
  }

  const { user_id, identifier, first_name, last_name, image_url } =
    data.public_user_data;
  const name =
    [first_name, last_name].filter(Boolean).join(" ").trim() ||
    identifier ||
    "Unknown";
  const role = clerkRoleToMemberRole(data.role);

  await db.member.upsert({
    where: {
      orgId_clerkUserId: { orgId: org.id, clerkUserId: user_id },
    },
    create: {
      clerkUserId: user_id,
      orgId: org.id,
      email: identifier,
      name,
      avatarUrl: image_url,
      role,
      isActive: true,
    },
    update: {
      role,
      name,
      email: identifier,
      avatarUrl: image_url,
      isActive: true,
      deletedAt: null,
    },
  });

  console.log(`Member added: ${user_id} to org ${org.id} as ${role}`);
}

async function handleMembershipUpdated(data: {
  organization: { id: string };
  public_user_data: { user_id: string };
  role: string;
}) {
  const org = await db.organization.findUnique({
    where: { clerkOrgId: data.organization.id },
  });
  if (!org) return;

  const role = clerkRoleToMemberRole(data.role);
  await db.member.updateMany({
    where: { orgId: org.id, clerkUserId: data.public_user_data.user_id },
    data: { role },
  });

  console.log(
    `Member role updated: ${data.public_user_data.user_id} → ${role}`
  );
}

async function handleMembershipDeleted(data: {
  organization: { id: string };
  public_user_data: { user_id: string };
}) {
  const org = await db.organization.findUnique({
    where: { clerkOrgId: data.organization.id },
  });
  if (!org) return;

  await db.member.updateMany({
    where: {
      orgId: org.id,
      clerkUserId: data.public_user_data.user_id,
    },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  console.log(
    `Member removed: ${data.public_user_data.user_id} from org ${org.id}`
  );
}

async function handleUserUpdated(data: {
  id: string;
  email_addresses: Array<{ email_address: string; id: string }>;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
}) {
  const name =
    [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
    "Unknown";
  const primaryEmail = data.email_addresses[0]?.email_address;

  if (!primaryEmail) return;

  await db.member.updateMany({
    where: { clerkUserId: data.id },
    data: {
      name,
      email: primaryEmail,
      avatarUrl: data.image_url,
    },
  });

  console.log(`User profile synced: ${data.id}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Maps Clerk's organization roles to our MemberRole enum.
 * Clerk built-in roles: "org:admin" and "org:member"
 * You can add custom roles in Clerk Dashboard.
 */
function clerkRoleToMemberRole(clerkRole: string): MemberRole {
  switch (clerkRole) {
    case "org:admin":
      return MemberRole.ADMIN;
    case "org:owner":
      return MemberRole.OWNER;
    case "org:manager":
      return MemberRole.MANAGER;
    case "org:senior_writer":
      return MemberRole.SENIOR_WRITER;
    case "org:reviewer":
      return MemberRole.REVIEWER;
    case "org:viewer":
      return MemberRole.VIEWER;
    case "org:member":
    default:
      return MemberRole.WRITER;
  }
}
