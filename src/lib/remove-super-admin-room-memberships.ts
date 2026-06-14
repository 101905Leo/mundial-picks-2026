import { prisma } from "@/lib/prisma";

export async function removeSuperAdminRoomMemberships() {
  const superAdmins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  const superAdminIds = superAdmins.map((admin) => admin.id);

  if (superAdminIds.length === 0) {
    return { removed: 0, reassignedOwners: 0 };
  }

  const adminOwnedRooms = await prisma.league.findMany({
    where: { ownerId: { in: superAdminIds } },
    select: {
      id: true,
      memberships: {
        where: { userId: { notIn: superAdminIds } },
        select: { userId: true, role: true, joinedAt: true },
      },
    },
  });

  const ownerReplacements = adminOwnedRooms
    .map((room) => {
      const replacement = [...room.memberships].sort((left, right) => {
        if (left.role !== right.role) return left.role === "ADMIN" ? -1 : 1;
        return left.joinedAt.getTime() - right.joinedAt.getTime();
      })[0];

      return replacement ? { roomId: room.id, userId: replacement.userId } : null;
    })
    .filter((replacement): replacement is { roomId: string; userId: string } => Boolean(replacement));

  const operations = [
    ...ownerReplacements.map((replacement) =>
      prisma.league.update({
        where: { id: replacement.roomId },
        data: { ownerId: replacement.userId },
        select: { id: true },
      }),
    ),
    prisma.leagueMembership.deleteMany({
      where: { userId: { in: superAdminIds } },
    }),
  ];

  const results = await prisma.$transaction(operations);
  const removalResult = results[results.length - 1] as { count: number };

  return {
    removed: removalResult.count,
    reassignedOwners: ownerReplacements.length,
  };
}
