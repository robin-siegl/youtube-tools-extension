import { isRatingRequest, type RatingResponse } from '../shared/messages';
import { RatingService } from './ratings-service';

const ratingService = new RatingService();

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isRatingRequest(message)) return false;

  void ratingService
    .get(message.videoId)
    .then((data) => {
      const response: RatingResponse = { ok: true, data };
      sendResponse(response);
    })
    .catch((error: unknown) => {
      const response: RatingResponse = {
        ok: false,
        data: null,
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      };
      sendResponse(response);
    });

  return true;
});
