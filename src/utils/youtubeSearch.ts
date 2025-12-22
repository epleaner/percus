export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: number;
}

export interface YouTubeSearchResponse {
  items: YouTubeSearchResult[];
  nextPageToken?: string;
  currentThreshold?: number;
}

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_DATA_API_V3_API_KEY;
const YOUTUBE_SEARCH_API_URL = 'https://www.googleapis.com/youtube/v3/search';

export async function searchYouTubeVideos(
  query: string,
  maxResults: number = 10,
  pageToken?: string,
  currentThreshold?: number
): Promise<YouTubeSearchResponse> {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key is not configured');
  }

  // Progressive view count thresholds
  const thresholds = [100, 1000, 5000, 10000, 50000, 100000];
  
  // Determine which threshold to use
  let thresholdIndex = 0;
  if (currentThreshold !== undefined) {
    thresholdIndex = thresholds.indexOf(currentThreshold);
    if (thresholdIndex === -1) thresholdIndex = 0;
  }
  
  const maxViewCount = thresholds[thresholdIndex];
  const filteredResults: YouTubeSearchResult[] = [];
  let nextPageToken: string | undefined = pageToken;
  const maxSearchResults = 50;
  let totalSearched = 0;
  const maxTotalSearched = 200;

  try {
    // Keep searching until we have enough results or hit limits
    while (filteredResults.length < maxResults && totalSearched < maxTotalSearched) {
      // First, search for videos
      const searchParams = new URLSearchParams({
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: maxSearchResults.toString(),
        key: YOUTUBE_API_KEY,
        order: 'date',
      });

      if (nextPageToken) {
        searchParams.append('pageToken', nextPageToken);
      }

      const searchResponse = await fetch(`${YOUTUBE_SEARCH_API_URL}?${searchParams}`);
      
      if (!searchResponse.ok) {
        const error = await searchResponse.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(error.error?.message || `API error: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      
      if (!searchData.items || searchData.items.length === 0) {
        break; // No more results
      }

      totalSearched += searchData.items.length;
      const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');

      // Get statistics (including view count) for these videos
      const statsParams = new URLSearchParams({
        part: 'statistics',
        id: videoIds,
        key: YOUTUBE_API_KEY,
      });

      const statsResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${statsParams}`);
      
      if (!statsResponse.ok) {
        // If stats fail, skip this batch
        nextPageToken = searchData.nextPageToken;
        continue;
      }

      const statsData = await statsResponse.json();
      const statsMap = new Map(
        statsData.items.map((item: any) => [item.id, parseInt(item.statistics.viewCount || '0', 10)])
      );

      // Filter videos with view count < maxViewCount
      const batchResults = searchData.items
        .map((item: any) => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
          publishedAt: item.snippet.publishedAt,
          viewCount: statsMap.get(item.id.videoId) || 0,
        }))
        .filter((result: YouTubeSearchResult) => result.viewCount < maxViewCount);

      filteredResults.push(...batchResults);

      // Check if we have enough results
      if (filteredResults.length >= maxResults) {
        return {
          items: filteredResults.slice(0, maxResults),
          nextPageToken: searchData.nextPageToken,
          currentThreshold: maxViewCount,
        };
      }

      // Get next page token for pagination
      nextPageToken = searchData.nextPageToken;
      if (!nextPageToken) {
        break; // No more pages
      }
    }

    // If we found some results, return them with next page token
    if (filteredResults.length > 0) {
      return {
        items: filteredResults,
        nextPageToken: nextPageToken,
        currentThreshold: maxViewCount,
      };
    }
    
    // If no results with current threshold, try next threshold
    if (thresholdIndex < thresholds.length - 1) {
      return await searchYouTubeVideos(query, maxResults, undefined, thresholds[thresholdIndex + 1]);
    }

    // No results found
    return {
      items: [],
      currentThreshold: maxViewCount,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to search YouTube videos');
  }
}

