from abc import ABC, abstractmethod


class LLMProvider(ABC):
    @abstractmethod
    def chat(self, *args, **kwargs):
        pass

    @abstractmethod
    def embed(self, *args, **kwargs):
        pass
