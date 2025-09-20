from langchain.chains.summarize import load_summarize_chain
from langchain.docstore.document import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.chat_models import ChatOpenAI


class SummarizationService:
    def __init__(self, llm_provider, api_key: str):
        self.llm_provider = llm_provider
        self.api_key = api_key

    def get_summarizer(self):
        if self.llm_provider == "openai":
            llm = ChatOpenAI(
                temperature=0,
                model_name="gpt-3.5-turbo-1106",
                openai_api_key=self.api_key,
            )
            return load_summarize_chain(llm, chain_type="stuff")
        # Add other providers here in the future
        raise ValueError(f"Unsupported LLM provider: {self.llm_provider}")

    def summarize(self, text: str) -> str:
        summarizer = self.get_summarizer()

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
        docs = [Document(page_content=x) for x in text_splitter.split_text(text)]

        summary = summarizer.run(docs)
        return summary
