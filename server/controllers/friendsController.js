import prisma from '../config/database.js';
import { logAudit } from '../utils/auth.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { cleanSearchQuery, canonicalPair, parsePagination, parseSort } from '../utils/helpers.js';

/**
 * Get user's friends list
 */
export async function getFriends(req, res) {
  const friendships = await prisma.friend.findMany({
    where: {
      OR: [
        { userId: req.auth.userId },
        { friendId: req.auth.userId }
      ]
    },
    include: {
      user: { 
        select: { id: true, name: true, avatarUrl: true } 
      },
      friend: { 
        select: { id: true, name: true, avatarUrl: true } 
      }
    }
  });
  
  // Extract friend details based on which side of the relationship the user is on
  const friends = friendships.map(f => {
    const friendData = f.userId === req.auth.userId ? f.friend : f.user;
    return {
      id: friendData.id,
      name: friendData.name,
      avatarUrl: friendData.avatarUrl,
      friendshipId: f.id,
      createdAt: f.createdAt,
      isOnline: false // Will be updated via WebSocket
    };
  });
  
  res.json({ friends });
}

/**
 * Get friend requests
 */
export async function getFriendRequests(req, res) {
  const [sent, received] = await Promise.all([
    // Sent requests
    prisma.friendRequest.findMany({
      where: { senderId: req.auth.userId, status: 'PENDING' },
      include: {
        receiver: { 
          select: { id: true, name: true, avatarUrl: true } 
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    // Received requests
    prisma.friendRequest.findMany({
      where: { receiverId: req.auth.userId, status: 'PENDING' },
      include: {
        sender: { 
          select: { id: true, name: true, avatarUrl: true } 
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  ]);
  
  res.json({
    sent: sent.map(r => ({
      id: r.id,
      user: r.receiver,
      message: r.message,
      createdAt: r.createdAt
    })),
    received: received.map(r => ({
      id: r.id,
      user: r.sender,
      message: r.message,
      createdAt: r.createdAt
    }))
  });
}

/**
 * Send friend request
 */
export async function sendFriendRequest(req, res) {
  const { receiverId, message } = req.body;
  
  if (receiverId === req.auth.userId) {
    throw new ValidationError('Cannot send friend request to yourself');
  }
  
  // Check if receiver exists
  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { id: true, name: true }
  });
  
  if (!receiver) {
    throw new NotFoundError('User not found');
  }
  
  // Check if already friends
  const existingFriendship = await prisma.friend.findFirst({
    where: {
      OR: [
        { userId: req.auth.userId, friendId: receiverId },
        { userId: receiverId, friendId: req.auth.userId }
      ]
    }
  });
  
  if (existingFriendship) {
    throw new ValidationError('Already friends with this user');
  }
  
  // Check for existing pending request
  const existingRequest = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: req.auth.userId, receiverId, status: 'PENDING' },
        { senderId: receiverId, receiverId: req.auth.userId, status: 'PENDING' }
      ]
    }
  });
  
  if (existingRequest) {
    if (existingRequest.senderId === req.auth.userId) {
      throw new ValidationError('Friend request already sent');
    } else {
      // Auto-accept if there's a mutual request
      const [cUserId, cFriendId] = canonicalPair(existingRequest.senderId, existingRequest.receiverId);
      await prisma.$transaction([
        // Update the existing request to accepted
        prisma.friendRequest.update({
          where: { id: existingRequest.id },
          data: { status: 'ACCEPTED' }
        }),
        // Create the friendship
        prisma.friend.create({
          data: {
            userId: cUserId,
            friendId: cFriendId
          }
        })
      ]);
      
      await logAudit(req, 'friends.request.auto_accept', req.auth.userId, { 
        friendId: receiverId 
      });
      
      return res.status(201).json({ 
        message: 'Friend request accepted automatically (mutual request)',
        friendId: receiverId 
      });
    }
  }
  
  // Create new friend request
  const request = await prisma.friendRequest.create({
    data: {
      senderId: req.auth.userId,
      receiverId,
      message: message?.trim() || null
    },
    include: {
      receiver: { 
        select: { id: true, name: true, avatarUrl: true } 
      }
    }
  });
  
  await logAudit(req, 'friends.request.send', req.auth.userId, { 
    receiverId,
    requestId: request.id 
  });
  
  res.status(201).json({ 
    request: {
      id: request.id,
      user: request.receiver,
      message: request.message,
      createdAt: request.createdAt
    }
  });
}

/**
 * Accept friend request
 */
export async function acceptFriendRequest(req, res) {
  const request = await prisma.friendRequest.findFirst({
    where: { 
      id: req.params.id,
      receiverId: req.auth.userId,
      status: 'PENDING'
    }
  });
  
  if (!request) {
    throw new NotFoundError('Friend request not found');
  }
  
  // Create friendship and update request status in a transaction
  const [cUserId, cFriendId] = canonicalPair(request.senderId, request.receiverId);
  await prisma.$transaction([
    // Update request status
    prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: 'ACCEPTED' }
    }),
    // Create friendship
    prisma.friend.create({
      data: {
        userId: cUserId,
        friendId: cFriendId
      }
    })
  ]);
  
  await logAudit(req, 'friends.request.accept', req.auth.userId, { 
    requestId: request.id,
    friendId: request.senderId 
  });
  
  res.json({ message: 'Friend request accepted' });
}

/**
 * Reject friend request
 */
export async function rejectFriendRequest(req, res) {
  const request = await prisma.friendRequest.findFirst({
    where: { 
      id: req.params.id,
      receiverId: req.auth.userId,
      status: 'PENDING'
    }
  });
  
  if (!request) {
    throw new NotFoundError('Friend request not found');
  }
  
  await prisma.friendRequest.update({
    where: { id: request.id },
    data: { status: 'REJECTED' }
  });
  
  await logAudit(req, 'friends.request.reject', req.auth.userId, { 
    requestId: request.id,
    senderId: request.senderId 
  });
  
  res.json({ message: 'Friend request rejected' });
}

/**
 * Cancel friend request
 */
export async function cancelFriendRequest(req, res) {
  const request = await prisma.friendRequest.findFirst({
    where: { 
      id: req.params.id,
      senderId: req.auth.userId,
      status: 'PENDING'
    }
  });
  
  if (!request) {
    throw new NotFoundError('Friend request not found');
  }
  
  await prisma.friendRequest.update({
    where: { id: request.id },
    data: { status: 'CANCELLED' }
  });
  
  await logAudit(req, 'friends.request.cancel', req.auth.userId, { 
    requestId: request.id,
    receiverId: request.receiverId 
  });
  
  res.json({ message: 'Friend request cancelled' });
}

/**
 * Remove friend
 */
export async function removeFriend(req, res) {
  const { friendId } = req.params;
  
  const friendship = await prisma.friend.findFirst({
    where: {
      OR: [
        { userId: req.auth.userId, friendId },
        { userId: friendId, friendId: req.auth.userId }
      ]
    }
  });
  
  if (!friendship) {
    throw new NotFoundError('Friendship not found');
  }
  
  await prisma.friend.delete({
    where: { id: friendship.id }
  });
  
  await logAudit(req, 'friends.remove', req.auth.userId, { 
    friendId,
    friendshipId: friendship.id 
  });
  
  res.json({ message: 'Friend removed' });
}

/**
 * Search users for adding friends
 */
export async function searchUsers(req, res) {
  const { q } = req.query;
  const query = cleanSearchQuery(q);
  
  if (!query || query.length < 2) {
    return res.json({ users: [] });
  }
  
  // Get current user's friends and pending requests
  const [friendships, sentRequests, receivedRequests] = await Promise.all([
    prisma.friend.findMany({
      where: {
        OR: [
          { userId: req.auth.userId },
          { friendId: req.auth.userId }
        ]
      }
    }),
    prisma.friendRequest.findMany({
      where: { senderId: req.auth.userId, status: 'PENDING' }
    }),
    prisma.friendRequest.findMany({
      where: { receiverId: req.auth.userId, status: 'PENDING' }
    })
  ]);
  
  // Get IDs of users who are already friends or have pending requests
  const excludeIds = new Set([req.auth.userId]);
  friendships.forEach(f => {
    excludeIds.add(f.userId === req.auth.userId ? f.friendId : f.userId);
  });
  sentRequests.forEach(r => excludeIds.add(r.receiverId));
  receivedRequests.forEach(r => excludeIds.add(r.senderId));
  
  // Search for users
  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { notIn: Array.from(excludeIds) } },
        {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } }
          ]
        }
      ]
    },
    select: {
      id: true,
      name: true,
      avatarUrl: true
    },
    take: 10
  });
  
  res.json({ users });
}

/**
 * Get friends online status
 */
export async function getOnlineStatus(req, res) {
  // Get user's friends
  const friendships = await prisma.friend.findMany({
    where: {
      OR: [
        { userId: req.auth.userId },
        { friendId: req.auth.userId }
      ]
    }
  });
  
  const friendIds = friendships.map(f => 
    f.userId === req.auth.userId ? f.friendId : f.userId
  );
  
  // Check which friends are in active sessions
  const activeSessions = await prisma.realtimeParticipant.findMany({
    where: {
      userId: { in: friendIds },
      isOnline: true
    },
    select: {
      userId: true,
      session: {
        select: { gameId: true, type: true }
      }
    }
  });
  
  // Create a map of online friends with their activity
  const onlineFriends = {};
  activeSessions.forEach(p => {
    if (!onlineFriends[p.userId]) {
      onlineFriends[p.userId] = {
        isOnline: true,
        activity: p.session ? {
          gameId: p.session.gameId,
          type: p.session.type
        } : null
      };
    }
  });
  
  res.json({ onlineFriends });
}

/**
 * Get friends' games listing
 */
export async function getFriendsGames(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const q = cleanSearchQuery(req.query.q);
  const sort = parseSort(req.query.sort, ['updatedAt', 'name', 'likes', 'views'], { updatedAt: 'desc' });

  // 1) Resolve friend IDs
  const friendships = await prisma.friend.findMany({
    where: {
      OR: [
        { userId: req.auth.userId },
        { friendId: req.auth.userId }
      ]
    }
  });
  const friendIds = friendships.map(f => (f.userId === req.auth.userId ? f.friendId : f.userId));

  if (friendIds.length === 0) {
    return res.json({ games: [], total: 0, page, limit });
  }

  // 2) Build filter
  const visibilityOrPublished = [{ visibility: 'PUBLIC' }, { visibility: 'FRIENDS' }, { published: true }];
  const searchFilter = q ? { name: { contains: q, mode: 'insensitive' } } : {};
  const where = {
    AND: [
      {
        OR: [
          { AND: [ { ownerId: { in: friendIds } }, { OR: visibilityOrPublished } ] },
          { members: { some: { userId: req.auth.userId } } }
        ]
      },
      searchFilter
    ]
  };

  // 3) Query
  const [total, games] = await Promise.all([
    prisma.game.count({ where }),
    prisma.game.findMany({
      where,
      orderBy: (sort.likes || sort.views) ? undefined : sort,
      skip: offset,
      take: limit,
      select: {
        id: true,
        name: true,
        updatedAt: true,
        visibility: true,
        thumbnail: true,
        owner: { select: { id: true, name: true } },
        _count: { select: { likes: true } },
      }
    })
  ]);

  // 4) Views for these games (optional table)
  let viewsMap = {};
  try {
    const hasGameView = await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='GameView'"
    ).then(rows => Array.isArray(rows) && rows.length > 0).catch(() => false);
    if (hasGameView) {
      const v = await prisma.gameView.groupBy({
        by: ['gameId'],
        _count: { _all: true },
        where: { gameId: { in: games.map(g => g.id) } }
      });
      viewsMap = Object.fromEntries(v.map(x => [x.gameId, x._count._all]));
    }
  } catch {}

  let list = games.map(g => ({
    id: g.id,
    name: g.name,
    updatedAt: g.updatedAt,
    visibility: g.visibility,
    thumbnail: g.thumbnail,
    ownerName: g.owner?.name,
    _count: g._count,
    views: viewsMap[g.id] || 0,
  }));

  // Manual likes/views sorting within page window
  if (sort.likes) {
    list.sort((a, b) => sort.likes === 'desc' ? ((b._count?.likes||0) - (a._count?.likes||0)) : ((a._count?.likes||0) - (b._count?.likes||0)));
  }
  if (sort.views) {
    list.sort((a, b) => sort.views === 'desc' ? ((b.views||0) - (a.views||0)) : ((a.views||0) - (b.views||0)));
  }

  res.json({ games: list, total, page, limit });
}
