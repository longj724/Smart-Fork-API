// External Dependencies
import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

// Relative Dependencies
import { supabaseClient } from '../utils/supabaseClient';
import { error } from 'console';

const router = express.Router();

router.post('/create-strava-access-token', async (req, res, next) => {
  const supabase = await supabaseClient(req.headers.authorization as string);
  try {
    const { clientId, clientSecret, code, grantType, userId } = req.body;

    const response = await axios.post(
      `https://www.strava.com/oauth/token?client_id=${clientId}&client_secret=${clientSecret}&code=${code}&grant_type=${grantType}`
    );

    const { data } = response;

    const { access_token, expires_at, refresh_token, athlete } = data;

    const { error: accessTokenDataError } = await supabase
      .from('Access_Tokens')
      .insert({
        user_id: userId,
        access_token,
        expires_at,
        athlete_id: athlete.id,
      });

    const { error: refreshTokenDataError } = await supabase
      .from('Refresh_Tokens')
      .insert({
        user_id: userId,
        refresh_token,
        athlete_id: athlete.id,
      });

    if (accessTokenDataError || refreshTokenDataError) return next(error);

    res.json({ data });
  } catch (error: any) {
    next(error);
  }
});

router.get('/strava-activities/:userId', async (req, res, next) => {
  try {
    const supabase = await supabaseClient(req.headers.authorization as string);
    const { userId } = req.params;

    const { data: currentAccessTokenData } = await supabase
      .from('Access_Tokens')
      .select('*')
      .eq('user_id', userId);

    if (currentAccessTokenData) {
      const expiresAt = currentAccessTokenData[0].expires_at;

      const currentTimestamp = Date.now() / 1000;

      if (currentTimestamp < expiresAt) {
        const activitiesData = await getActivities(
          currentAccessTokenData[0].access_token
        );
        return res.json({ userConnected: true, activityData: activitiesData });
      } else {
        // Get new refresh token
        const { data: oldRefreshTokenData, error } = await supabase
          .from('Refresh_Tokens')
          .select('*')
          .eq('user_id', userId);

        if (!oldRefreshTokenData || error) return next(error);

        const newRefreshData = {
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          refresh_token: oldRefreshTokenData[0].refresh_token,
          grant_type: 'refresh_token',
        };

        const reauthorizeResponse = await axios.post(
          'https://www.strava.com/oauth/token',
          newRefreshData
        );

        const { data: reauthorizedTokenData } = reauthorizeResponse;

        const {
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          expires_at: newExpiresAt,
        } = reauthorizedTokenData;

        await supabase
          .from('Access_Tokens')
          .update({
            access_token: newAccessToken,
            expires_at: newExpiresAt,
          })
          .eq('user_id', userId);

        await supabase
          .from('Refresh_Tokens')
          .update({
            refresh_token: newRefreshToken,
          })
          .eq('user_id', userId);

        const activitiesData = await getActivities(newAccessToken);
        return res.json({ userConnected: true, activityData: activitiesData });
      }
    }

    return res.json({ userConnected: false });
  } catch (error) {
    next(error);
  }
});

const getActivities = async (accessToken: string) => {
  const { data } = await axios.get(
    `https://www.strava.com/api/v3/athlete/activities?access_token=${accessToken}`
  );

  const condensedData = data.map((activity: any) => ({
    startDateLocal: activity.start_date_local,
    name: activity.name,
    sportType: activity.sport_type,
    movingTime: activity.moving_time,
    distance: activity.distance,
  }));
  return condensedData;
};

export { router as workoutsRouter };
