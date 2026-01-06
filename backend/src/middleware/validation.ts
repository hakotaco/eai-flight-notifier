import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validateSignup = (req: Request, res: Response, next: NextFunction): void => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    name: Joi.string().min(2).max(255).required(),
    homeAddress: Joi.string().required(),
    flightNumber: Joi.string().pattern(/^[A-Z0-9]{2,3}[0-9]{1,4}$/).required(),
    departureDate: Joi.date().iso().greater('now').required()
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(d => d.message)
    });
    return;
  }
  
  next();
};
