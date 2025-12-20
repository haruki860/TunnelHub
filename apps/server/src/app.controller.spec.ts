/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { ConfigService } from '@nestjs/config';
import { EventsGateway } from './events.gateway';

// EventsGatewayのモック
const mockEventsGateway = {
  getTunnelInfo: jest.fn(),
  broadcastRequest: jest.fn(),
  broadcastLog: jest.fn(),
};

// ConfigServiceのモック
const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'webUrl') return 'http://localhost:3001';
    return null;
  }),
};

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: EventsGateway,
          useValue: mockEventsGateway,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });

  describe('receiveHttp', () => {
    it('should be defined', () => {
      expect(appController.receiveHttp).toBeDefined();
    });
  });
});
