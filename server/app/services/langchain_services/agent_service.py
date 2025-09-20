from app.agents.my_strand_agent import MyStrandAgent
from app.schemas.agent import AgentInput, AgentResponse


class AgentService:
    def __init__(self):
        self.agent = MyStrandAgent()  # Instantiate your LoreBridge agent

    async def run_agent_process(self, input_data: AgentInput) -> AgentResponse:
        """
        Orchestrates the interaction with the LoreBridge strand agent.
        """
        print(
            f"Service preparing to run LoreBridge agent with query: {input_data.query}"
        )

        agent_raw_result = await self.agent.process_query(
            query=input_data.query, context=input_data.context
        )

        response = AgentResponse(
            result=agent_raw_result,
            agent_actions=[
                "simulated_lore_lookup",
                "simulated_story_generation",
            ],  # Simulate agent actions
        )
        return response
