import { Request, Response } from "express";
import { AppDataSource } from "../config/database";
import { UserFlightSubscription } from "../entities/UserFlightSubscription";
import { User } from "../entities/User";

export const unsubscribe = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { subscriptionId } = req.params;

  try {
    const subscriptionRepository =
      AppDataSource.getRepository(UserFlightSubscription);
    const userRepository = AppDataSource.getRepository(User);

    // Find the subscription
    const subscription = await subscriptionRepository.findOne({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      res.status(404).send(`
        <html>
          <head>
            <title>Subscription Not Found</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 50px; text-align: center; }
              .message { background-color: #f44336; color: white; padding: 20px; border-radius: 8px; display: inline-block; }
            </style>
          </head>
          <body>
            <div class="message">
              <h2>❌ Subscription Not Found</h2>
              <p>This subscription link is invalid or has already been used.</p>
            </div>
          </body>
        </html>
      `);
      return;
    }

    // Get user info for display
    const user = await userRepository.findOne({
      where: { id: subscription.userId },
    });

    // Delete the subscription
    await subscriptionRepository.remove(subscription);

    res.status(200).send(`
      <html>
        <head>
          <title>Unsubscribed Successfully</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 50px; 
              text-align: center; 
              background-color: #f5f5f5;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .success { 
              color: #4caf50; 
              font-size: 48px;
              margin-bottom: 20px;
            }
            h2 { color: #2c3e50; }
            p { color: #666; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✓</div>
            <h2>Successfully Unsubscribed</h2>
            <p>Hello ${user?.name || 'there'},</p>
            <p>You have been successfully unsubscribed from flight notifications.</p>
            <p>You will no longer receive email updates about this flight.</p>
            <p style="margin-top: 30px; color: #999; font-size: 14px;">
              If you change your mind, you can always sign up again at our website.
            </p>
          </div>
        </body>
      </html>
    `);

    console.log(
      `Subscription ${subscriptionId} removed for user ${subscription.userId}`
    );
  } catch (error) {
    console.error("Error unsubscribing:", error);
    res.status(500).send(`
      <html>
        <head>
          <title>Error</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 50px; text-align: center; }
            .error { background-color: #f44336; color: white; padding: 20px; border-radius: 8px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="error">
            <h2>⚠️ Error</h2>
            <p>Something went wrong. Please try again later.</p>
          </div>
        </body>
      </html>
    `);
  }
};
