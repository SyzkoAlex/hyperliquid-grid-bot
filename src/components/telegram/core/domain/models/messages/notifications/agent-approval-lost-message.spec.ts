import { describe, it, expect } from 'vitest';
import { AgentApprovalLostMessage } from './agent-approval-lost-message';
import { AgentApprovalLostEvent } from '@domain/models/events/trading/agent-approval-lost.event';

describe('AgentApprovalLostMessage', () => {
    it('contains "Agent Wallet Approval Lost"', () => {
        const msg = AgentApprovalLostMessage.create();
        expect(msg.text).toContain('Agent Wallet Approval Lost');
    });

    it('contains reconnect instruction', () => {
        const msg = AgentApprovalLostMessage.create();
        expect(msg.text).toContain('reconnect');
    });

    it('fromEvent returns the same message as create', () => {
        const event = new AgentApprovalLostEvent('user-1');
        const msg = AgentApprovalLostMessage.fromEvent(event);
        expect(msg.text).toBe(AgentApprovalLostMessage.create().text);
    });
});
