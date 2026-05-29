// Core shared types for Nigerian Political War Room

// A normalized signal from any ingestion source
export interface Signal {
	id: string;
	title: string;
	content: string;
	source: string;
	timestamp: string; // ISO string
	sentiment: number; // -1 to 1
	type: 'news' | 'tweet' | 'youtube' | 'rss' | 'other';
	raw?: any;
}

// A detected narrative (theme, topic, or storyline)
export interface Narrative {
	id: string;
	title: string;
	description: string;
	signals: string[]; // Signal IDs
	influencers: string[]; // Influencer IDs
	sentiment: number;
	createdAt: string;
	updatedAt: string;
}

// A political influencer or actor
export interface Influencer {
	id: string;
	name: string;
	handle?: string;
	type: 'individual' | 'organization' | 'media';
	profileUrl?: string;
	avatarUrl?: string;
	influenceScore: number;
}

// Feedback from users or AI
export interface Feedback {
	id: string;
	narrativeId?: string;
	userId?: string;
	aiFeedback?: string;
	createdAt: string;
}