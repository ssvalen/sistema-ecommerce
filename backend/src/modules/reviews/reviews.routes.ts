import { Router } from 'express';
import { authenticate, authorize } from '../identity/index.js';
import * as reviews from './reviews.controller.js';
import './reviews.openapi.js';

const customer = [authenticate, authorize('CUSTOMER')];

// Montado en /products/:id/reviews.
export const productReviewsRouter = Router({ mergeParams: true });
productReviewsRouter.get('/', reviews.listReviews);
productReviewsRouter.get('/me', ...customer, reviews.getMyReview);
productReviewsRouter.put('/me', ...customer, reviews.saveMyReview);
productReviewsRouter.delete('/me', ...customer, reviews.deleteMyReview);

export const reviewsRouter = Router();
reviewsRouter.delete('/:id', authenticate, authorize('ADMIN'), reviews.deleteReview);
