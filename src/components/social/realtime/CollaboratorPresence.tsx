import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Crown, 
  Edit3, 
  Eye, 
  Gamepad2,
  Circle,
  MousePointer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CollabParticipant } from '@/hooks/useCollabClient';

interface CollaboratorPresenceProps {
  participants: CollabParticipant[];
  currentUserId?: string;
  showCursors?: boolean;
  className?: string;
}

const CollaboratorPresence: React.FC<CollaboratorPresenceProps> = ({
  participants,
  currentUserId,
  showCursors = true,
  className
}) => {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="h-3 w-3" />;
      case 'EDITOR':
        return <Edit3 className="h-3 w-3" />;
      case 'PLAYER':
        return <Gamepad2 className="h-3 w-3" />;
      case 'VIEWER':
      default:
        return <Eye className="h-3 w-3" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/10';
      case 'EDITOR':
        return 'text-blue-500 border-blue-500/20 bg-blue-500/10';
      case 'PLAYER':
        return 'text-green-500 border-green-500/20 bg-green-500/10';
      case 'VIEWER':
      default:
        return 'text-gray-500 border-gray-500/20 bg-gray-500/10';
    }
  };

  const getParticipantColor = (userId: string, index: number) => {
    // Generate consistent colors for each participant
    const colors = [
      '#3B82F6', // blue
      '#EF4444', // red
      '#10B981', // emerald
      '#F59E0B', // amber
      '#8B5CF6', // violet
      '#06B6D4', // cyan
      '#F97316', // orange
      '#84CC16'  // lime
    ];
    
    // Use userId hash or index for consistent color assignment
    const colorIndex = userId ? 
      Array.from(userId).reduce((a, b) => a + b.charCodeAt(0), 0) % colors.length :
      index % colors.length;
      
    return colors[colorIndex];
  };

  const onlineParticipants = participants.filter(p => p.isOnline && p.userId !== currentUserId);

  if (onlineParticipants.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Participant List */}
      <Card className="bg-card/95 backdrop-blur-sm border-border shadow-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Circle className="h-3 w-3 fill-green-500 text-green-500" />
          <span className="text-xs font-medium text-foreground">
            Online ({onlineParticipants.length})
          </span>
        </div>
        
        <div className="space-y-2">
          {onlineParticipants.map((participant, index) => {
            const participantColor = getParticipantColor(participant.userId, index);
            
            return (
              <Tooltip key={participant.id}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 p-1 rounded-md hover:bg-accent/50 transition-colors">
                    <div className="relative">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback 
                          className="text-xs"
                          style={{ backgroundColor: participantColor + '20', color: participantColor }}
                        >
                          {participant.userName[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      {participant.presence?.online && (
                        <div 
                          className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card"
                          style={{ backgroundColor: participantColor }}
                        />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium truncate">
                          {participant.userName}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={cn('text-xs', getRoleColor(participant.role))}
                        >
                          {getRoleIcon(participant.role)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </TooltipTrigger>
                
                <TooltipContent side="left">
                  <div className="space-y-1">
                    <div className="font-medium">{participant.userName}</div>
                    <div className="text-xs text-muted-foreground">
                      Role: {participant.role}
                    </div>
                    {participant.presence?.selectedBlocks && participant.presence.selectedBlocks.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Selected: {participant.presence.selectedBlocks.length} blocks
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </Card>

      {/* Cursors and Selection Indicators (for 3D scene) */}
      {showCursors && (
        <div className="absolute inset-0 pointer-events-none">
          {onlineParticipants.map((participant, index) => {
            const participantColor = getParticipantColor(participant.userId, index);
            const cursor = participant.presence?.cursor;
            const selectedBlocks = participant.presence?.selectedBlocks || [];

            if (!cursor) return null;

            return (
              <div key={`cursor-${participant.id}`}>
                {/* Cursor indicator */}
                <div
                  className="absolute z-50 pointer-events-none"
                  style={{
                    left: `${cursor.x}px`,
                    top: `${cursor.y}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <div className="relative">
                    <MousePointer 
                      className="h-4 w-4 drop-shadow-sm"
                      style={{ color: participantColor }}
                    />
                    <div 
                      className="absolute -top-6 left-4 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap"
                      style={{ borderLeft: `2px solid ${participantColor}` }}
                    >
                      {participant.userName}
                    </div>
                  </div>
                </div>

                {/* Selection indicators (this would need integration with 3D scene) */}
                {selectedBlocks.length > 0 && (
                  <div className="absolute top-2 left-2 z-40">
                    <Badge 
                      variant="outline"
                      className="text-xs"
                      style={{ 
                        borderColor: participantColor, 
                        backgroundColor: participantColor + '20',
                        color: participantColor
                      }}
                    >
                      {participant.userName}: {selectedBlocks.length} selected
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CollaboratorPresence;
