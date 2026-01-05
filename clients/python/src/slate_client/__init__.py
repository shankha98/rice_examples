import sys
import os
sys.path.append(os.path.dirname(__file__))

import grpc
try:
    from . import slate_pb2
    from . import slate_pb2_grpc
except ImportError as e:
    print(f"Slate Client Import Error: {e}")
    # pass

class CortexClient:
    def __init__(self, address='localhost:50051', token=None):
        self.channel = grpc.insecure_channel(address)
        self.stub = slate_pb2_grpc.CortexStub(self.channel)
        self.token = token

    def _metadata(self):
        if self.token:
            return [('authorization', f'{self.token}')]
        return []

    def focus(self, content):
        return self.stub.Focus(slate_pb2.FocusRequest(content=content), metadata=self._metadata())

    def drift(self):
        return self.stub.Drift(slate_pb2.DriftRequest(), metadata=self._metadata())

    def commit(self, input, outcome, reasoning="", action="", agent_id="user"):
        trace = slate_pb2.Trace(
            input=input,
            outcome=outcome,
            reasoning=reasoning,
            action=action,
            agent_id=agent_id,
            embedding=[0.0] * 768
        )
        return self.stub.Commit(trace, metadata=self._metadata())

    def reminisce(self, query_text, limit=5):
        req = slate_pb2.RecallRequest(
            embedding=[0.0] * 768,
            limit=limit,
            query_text=query_text
        )
        return self.stub.Reminisce(req, metadata=self._metadata())

    def trigger(self, skill_name):
        req = slate_pb2.ReflexRequest(skill_name=skill_name)
        return self.stub.Trigger(req, metadata=self._metadata())
