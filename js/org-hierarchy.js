// =====================================================
// ORGANIZATIONAL HIERARCHY SYSTEM
// Manages organizational structure and core team identification
// =====================================================

class OrganizationalHierarchy {
    constructor() {
        this.hierarchy = {
            'Convener': { level: 1, isCoreTeam: true, color: '#8B5CF6', icon: '👑' },
            'Joint Convener': { level: 2, isCoreTeam: true, color: '#7C3AED', icon: '🤝' },
            'Member Secretary': { level: 3, isCoreTeam: true, color: '#6D28D9', icon: '📋' },
            'Team Coordinator': { level: 4, isCoreTeam: true, color: '#5B21B6', icon: '👥' },
            'Member': { level: 5, isCoreTeam: false, color: '#1E40AF', icon: '👤' }
        };
        
        this.teams = [
            'Core Team',
            'Graphics Design',
            'Content Writing',
            'Social Media',
            'Photo & Video Editing',
            'Photography',
            'Research & Development',
            'Rover Paper',
            'Presentation'
        ];
    }

    // Check if a member is core team based on position or team
    isCoreTeamMember(member) {
        if (!member) return false;
        
        // Core team if team_name is "Core Team"
        if (member.team_name === 'Core Team') {
            return true;
        }
        
        // Core team if position is Team Coordinator or higher
        const positionInfo = this.hierarchy[member.position];
        return positionInfo ? positionInfo.isCoreTeam : false;
    }

    // Get position information
    getPositionInfo(position) {
        return this.hierarchy[position] || this.hierarchy['Member'];
    }

    // Get hierarchy level (lower number = higher position)
    getHierarchyLevel(position) {
        const info = this.getPositionInfo(position);
        return info.level;
    }

    // Check if position A is higher than position B
    isHigherPosition(positionA, positionB) {
        return this.getHierarchyLevel(positionA) < this.getHierarchyLevel(positionB);
    }

    // Get all positions sorted by hierarchy
    getAllPositions() {
        return Object.keys(this.hierarchy).sort((a, b) => 
            this.getHierarchyLevel(a) - this.getHierarchyLevel(b)
        );
    }

    // Get core team positions only
    getCoreTeamPositions() {
        return Object.keys(this.hierarchy)
            .filter(position => this.hierarchy[position].isCoreTeam)
            .sort((a, b) => this.getHierarchyLevel(a) - this.getHierarchyLevel(b));
    }

    // Generate organizational chart data
    generateOrgChart(members) {
        const chart = {};
        
        // Group members by position
        members.forEach(member => {
            const position = member.position || 'Member';
            if (!chart[position]) {
                chart[position] = [];
            }
            chart[position].push(member);
        });
        
        // Sort positions by hierarchy
        const sortedPositions = Object.keys(chart).sort((a, b) => 
            this.getHierarchyLevel(a) - this.getHierarchyLevel(b)
        );
        
        return sortedPositions.map(position => ({
            position,
            members: chart[position],
            info: this.getPositionInfo(position),
            count: chart[position].length
        }));
    }

    // Get member's authority level for permissions
    getAuthorityLevel(member) {
        if (!member) return 0;
        
        const positionLevel = this.getHierarchyLevel(member.position);
        
        // Special authority for core team members
        if (this.isCoreTeamMember(member)) {
            return Math.max(10 - positionLevel, 5); // Minimum level 5 for core team
        }
        
        return Math.max(10 - positionLevel, 1); // Minimum level 1 for regular members
    }

    // Check if member can perform action on target
    canPerformAction(actor, target, action) {
        if (!actor) return false;
        
        const actorLevel = this.getAuthorityLevel(actor);
        const targetLevel = target ? this.getAuthorityLevel(target) : 0;
        
        switch (action) {
            case 'view':
                return true; // Everyone can view
            case 'edit':
                return actorLevel >= 5 || actor.id === target?.id; // Core team or self
            case 'delete':
                return actorLevel >= 7; // High-level positions only
            case 'assign_task':
                return actorLevel >= 4; // Team coordinators and above
            case 'manage_team':
                return actorLevel >= 6; // Member Secretary and above
            default:
                return false;
        }
    }

    // Get member's display badge
    getMemberBadge(member) {
        const positionInfo = this.getPositionInfo(member.position);
        const isCoreTeam = this.isCoreTeamMember(member);
        
        return {
            position: member.position || 'Member',
            icon: positionInfo.icon,
            color: positionInfo.color,
            isCoreTeam,
            level: positionInfo.level,
            badge: isCoreTeam ? 'Core Team' : 'Team Member'
        };
    }

    // Generate hierarchy visualization data
    getHierarchyVisualization() {
        return this.getAllPositions().map(position => {
            const info = this.getPositionInfo(position);
            return {
                position,
                level: info.level,
                icon: info.icon,
                color: info.color,
                isCoreTeam: info.isCoreTeam,
                description: this.getPositionDescription(position)
            };
        });
    }

    // Get position description
    getPositionDescription(position) {
        const descriptions = {
            'Convener': 'Overall leadership and strategic direction',
            'Joint Convener': 'Assists convener in organizational leadership',
            'Member Secretary': 'Manages organizational documentation and communications',
            'Team Coordinator': 'Leads specific team and manages team activities',
            'Member': 'Active participant in team activities and projects'
        };
        
        return descriptions[position] || 'Team member';
    }

    // Get team statistics
    getTeamStatistics(members) {
        const stats = {
            total: members.length,
            coreTeam: 0,
            byPosition: {},
            byTeam: {},
            hierarchy: []
        };
        
        members.forEach(member => {
            // Core team count
            if (this.isCoreTeamMember(member)) {
                stats.coreTeam++;
            }
            
            // By position
            const position = member.position || 'Member';
            stats.byPosition[position] = (stats.byPosition[position] || 0) + 1;
            
            // By team
            const team = member.team_name || 'Unassigned';
            stats.byTeam[team] = (stats.byTeam[team] || 0) + 1;
        });
        
        // Hierarchy breakdown
        stats.hierarchy = this.getAllPositions().map(position => ({
            position,
            count: stats.byPosition[position] || 0,
            info: this.getPositionInfo(position)
        }));
        
        return stats;
    }
}

// Create global instance
const orgHierarchy = new OrganizationalHierarchy();
window.orgHierarchy = orgHierarchy;

export default orgHierarchy;