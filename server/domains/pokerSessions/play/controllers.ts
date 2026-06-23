import { pokerSessionsSchemas } from '@chpokify/api-schemas';
import { PokerSessionService } from '@pokerSessions/services/PokerSession';

import { createHandler } from '@core/middleware/createHandler';
import { TAppRequest, TAppResponse } from '@core/types';

import { TPokerSessionDocument } from '@models/pokerSession';
import { TStoryDocument } from '@models/story';

const chooseCard = createHandler(async (
  req: TAppRequest<{}, pokerSessionsSchemas.TChooseCardsBodyReq>,
  res: TAppResponse<pokerSessionsSchemas.TChooseCardsResResp>
) => {
  const pokerSession = res.locals.get('pokerSession') as TPokerSessionDocument;
  const {
    user,
    body: {
      teamId,
      cardId,
    },
  } = req;
  const story = res.locals.get('story') as TStoryDocument;

  const pokerSessionService = new PokerSessionService(pokerSession);

  await pokerSessionService.chooseCard({
    userId: user._id,
    teamId,
    storyId: story._id,
    cardId,
  });

  await pokerSession.save();

  res.locals.result = {
    pokerSession,
  };
});

const playControllers = {
  chooseCard,
};

export { playControllers };
