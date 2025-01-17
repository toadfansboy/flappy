/* eslint-disable max-classes-per-file */
import { expect, test, vi, describe, beforeEach } from 'vitest'
import { createFlappyAgent } from './flappy-agent'
import { LLMBase } from './llms/llm-base'
import { type ChatMLMessage, type GenerateConfig, type ChatMLResponse } from './llms/interface'
import { type IsNever, z } from './flappy-type'
import { env } from 'node:process'
import { createCodeInterpreter, createInvokeFunction, createSynthesizedFunction } from './features'
import { type FindFlappyFeature } from './flappy-feature'
import { type FlappyFeatureDefinitions } from './flappy-feature.interface'

test('create flappy agent normally', async () => {
  class TestLLM extends LLMBase {
    override maxTokens: number = 9999
    public override async chatComplete(
      messages: ChatMLMessage[],
      config?: GenerateConfig | undefined
    ): Promise<ChatMLResponse> {
      return {
        success: true,
        data: 'data'
      }
    }
  }
  const llm = new TestLLM()
  const invokeValue = 'invokeValue'
  const invokeFunction = createInvokeFunction({
    name: 'invokeFunction',
    description: 'invokeFunction',
    args: z.object({
      lawsuit: z.string().describe('Lawsuit full text.')
    }),
    returnType: z.string(),
    resolve: async () => invokeValue
  })

  const synthesizedFunction = createSynthesizedFunction({
    name: 'synthesizedFunction',
    description: 'synthesizedFunction',
    args: z.object({}),
    returnType: z.string()
  })
  const agent = createFlappyAgent({
    llm,
    features: [synthesizedFunction, invokeFunction]
  })

  expect(agent.llm).toBe(llm)
  expect(agent.llmPlaner).toBe(llm)

  expect(agent.executePlanSystemMessage().content).toMatchInlineSnapshot(`
    "You are an AI assistant that makes step-by-step plans to solve problems, utilizing external functions. Each step entails one plan followed by a function-call, which will later be executed to gather args for that step.
            Make as few plans as possible if it can solve the problem.
            The functions list is described using the following YAML schema array:
            - name: synthesizedFunction
      description: synthesizedFunction
      parameters:
        type: object
        properties:
          args:
            type: object
            properties: {}
            description: Function arguments
          returnType:
            type: string
            description: Function return type
    - name: invokeFunction
      description: invokeFunction
      parameters:
        type: object
        properties:
          args:
            type: object
            properties:
              lawsuit:
                type: string
                description: Lawsuit full text.
            required:
              - lawsuit
            description: Function arguments
          returnType:
            type: string
            description: Function return type


            Your specified plans should be output as JSON object array and adhere to the following JSON schema:
            {
        \\"type\\": \\"array\\",
        \\"items\\": {
            \\"type\\": \\"object\\",
            \\"properties\\": {
                \\"thought\\": {
                    \\"type\\": \\"string\\",
                    \\"description\\": \\"The thought why this step is needed.\\"
                },
                \\"id\\": {
                    \\"type\\": \\"integer\\",
                    \\"exclusiveMinimum\\": 0,
                    \\"description\\": \\"Increment id starting from 1\\"
                },
                \\"functionName\\": {
                    \\"type\\": \\"string\\"
                },
                \\"args\\": {
                    \\"type\\": \\"object\\",
                    \\"additionalProperties\\": {},
                    \\"description\\": \\"an object encapsulating all arguments for a function call. If an argument's value is derived from the return of a previous step, it should be as '%@_' + the ID of the previous step (e.g. '%@_1'). If an argument's value is derived from the **previous** step's function's return value's properties, '.' should be used to access its properties, else just use id with prefix. This approach should remain compatible with the 'args' attribute in the function's JSON schema.\\"
                }
            },
            \\"required\\": [
                \\"thought\\",
                \\"id\\",
                \\"functionName\\",
                \\"args\\"
            ],
            \\"additionalProperties\\": false
        },
        \\"description\\": \\"An array storing the steps.\\"
    }

            Only the listed functions are allowed to be used."
  `)

  type Features = (typeof agent)['config']['features']
  type InvokeFunctionType = FindFlappyFeature<Features, 'invokeFunction'>
  const ok: IsNever<InvokeFunctionType> extends true ? true : false = false
  const foo: Parameters<InvokeFunctionType['call']>[1]['lawsuit'] = 'foo'
  const name: InvokeFunctionType['define']['name'] = 'invokeFunction'
  expect(await agent.callFunction('invokeFunction', { lawsuit: 'foo' })).toBe(invokeValue)
})

describe('execute plan', () => {
  let getLatestLawsuitsByPlaintiff = vi.fn()
  const SynthesizedFunctionDefine = {
    name: 'getMeta',
    description: 'Extract meta data from a lawsuit full text.',
    args: z.object({
      lawsuit: z.string().describe('Lawsuit full text.')
    }),
    returnType: z.object({
      plaintiff: z.string(),
      defendant: z.string(),
      judgeOptions: z.array(z.string())
    })
  }

  type InvokeArguments = FlappyFeatureDefinitions['invoke']['TDefinition']
  let InvokeFunctionDefine = {
    name: 'getLatestLawsuitsByPlaintiff',
    description: 'Get the latest lawsuits by plaintiff.',
    args: z.object({
      plaintiff: z.string(),
      arg1: z.boolean().describe('For demo purpose. set to False'),
      arg2: z.array(z.string()).describe('ignore it').optional()
    }),
    returnType: z.string(),
    resolve: async (...args: any[]) => getLatestLawsuitsByPlaintiff(args)
  } satisfies InvokeArguments

  beforeEach(() => {
    const MOCK_LAWSUIT_DATA =
      "As Alex Jones continues telling his Infowars audience about his money problems and pleads for them to buy his products, his own documents show life is not all that bad — his net worth is around $14 million and his personal spending topped $93,000 in July alone, including thousands of dollars on meals and entertainment. The conspiracy theorist and his lawyers file monthly financial reports in his personal bankruptcy case, and the latest one has struck a nerve with the families of victims of Sandy Hook Elementary School shooting. They're still seeking the $1.5 billion they won last year in lawsuits against Jones and his media company for repeatedly calling the 2012 massacre a hoax on his shows. “It is disturbing that Alex Jones continues to spend money on excessive household expenditures and his extravagant lifestyle when that money rightfully belongs to the families he spent years tormenting,” said Christopher Mattei, a Connecticut lawyer for the families. “The families are increasingly concerned and will continue to contest these matters in court.” In an Aug. 29 court filing, lawyers for the families said that if Jones doesn’t reduce his personal expenses to a “reasonable” level, they will ask the bankruptcy judge to bar him from “further waste of estate assets,” appoint a trustee to oversee his spending, or dismiss the bankruptcy case. On his Infowars show Tuesday, Jones said he’s not doing anything wrong."
    getLatestLawsuitsByPlaintiff = vi.fn().mockResolvedValue(MOCK_LAWSUIT_DATA)
    InvokeFunctionDefine = {
      name: 'getLatestLawsuitsByPlaintiff',
      description: 'Get the latest lawsuits by plaintiff.',
      args: z.object({
        plaintiff: z.string(),
        arg1: z.boolean().describe('For demo purpose. set to False'),
        arg2: z.array(z.string()).describe('ignore it').optional()
      }),
      returnType: z.string(),
      resolve: async (...args: any[]) => getLatestLawsuitsByPlaintiff(args)
    }
  })

  test('throw out error if the plan response is not a valid JSON', async () => {
    class TestLLM extends LLMBase {
      override maxTokens: number = 9999
      public override async chatComplete(
        messages: ChatMLMessage[],
        config?: GenerateConfig | undefined
      ): Promise<ChatMLResponse> {
        return {
          success: true,
          data: 'data'
        }
      }
    }
    const llm = new TestLLM()
    const agent = createFlappyAgent({
      llm,
      features: [createSynthesizedFunction(SynthesizedFunctionDefine), createInvokeFunction(InvokeFunctionDefine)]
    })

    await expect(async () => {
      await agent.executePlan(
        'Find the latest case with the plaintiff being families of victims and return its metadata.'
      )
    }).rejects.toThrowError()
  })

  test('throw out error if the synthesizedFunction response is not a valid JSON', async () => {
    class TestLLM extends LLMBase {
      override maxTokens: number = 9999
      public override async chatComplete(
        messages: ChatMLMessage[],
        config?: GenerateConfig | undefined
      ): Promise<ChatMLResponse> {
        if (messages[0]?.content.startsWith('You are an AI assistant')) {
          return {
            success: true,
            data: JSON.stringify([
              {
                thought:
                  "To find the latest case with the plaintiff being families of victims, we need to get the latest lawsuits by plaintiff 'families of victims'.",
                id: 1,
                functionName: 'getLatestLawsuitsByPlaintiff',
                args: {
                  plaintiff: 'families of victims',
                  arg1: false
                }
              },
              {
                thought: "To extract the metadata from the latest case, we need to use the 'getMeta' function.",
                id: 2,
                functionName: 'getMeta',
                args: {
                  lawsuit: '%@_1'
                }
              }
            ])
          }
        } else if (messages[0]?.content.startsWith('Extract meta data from a lawsuit full text')) {
          return {
            success: true,
            data: ''
          }
        }

        return {
          success: false,
          data: ''
        }
      }
    }
    const llm = new TestLLM()
    const agent = createFlappyAgent({
      llm,
      features: [createSynthesizedFunction(SynthesizedFunctionDefine), createInvokeFunction(InvokeFunctionDefine)]
    })

    await expect(async () => {
      await agent.executePlan(
        'Find the latest case with the plaintiff being families of victims and return its metadata.'
      )
    }).rejects.toThrowError()
  })

  test('execute plan attempts to retry when it failed', async () => {
    let retry = 0
    class TestLLM extends LLMBase {
      override maxTokens: number = 9999
      public override async chatComplete(
        messages: ChatMLMessage[],
        config?: GenerateConfig | undefined
      ): Promise<ChatMLResponse> {
        if (messages[0]?.content.startsWith('You are an AI assistant')) {
          if (retry === 0) {
            retry += 1
            return { success: true, data: 'invalid' }
          }
          return {
            success: true,
            data: JSON.stringify([
              {
                thought:
                  "To find the latest case with the plaintiff being families of victims, we need to get the latest lawsuits by plaintiff 'families of victims'.",
                id: 1,
                functionName: 'getLatestLawsuitsByPlaintiff',
                args: {
                  plaintiff: 'families of victims',
                  arg1: false
                }
              },
              {
                thought: "To extract the metadata from the latest case, we need to use the 'getMeta' function.",
                id: 2,
                functionName: 'getMeta',
                args: {
                  lawsuit: '%@_1'
                }
              }
            ])
          }
        } else if (messages[0]?.content.startsWith('Extract meta data from a lawsuit full text')) {
          return {
            success: true,
            data: JSON.stringify({
              plaintiff: 'John Doe',
              defendant: 'Jane Smith',
              judgeOptions: ['Judge A', 'Judge B', 'Judge C']
            })
          }
        }

        return {
          success: false,
          data: ''
        }
      }
    }
    const llm = new TestLLM()
    const agent = createFlappyAgent({
      llm,
      features: [createSynthesizedFunction(SynthesizedFunctionDefine), createInvokeFunction(InvokeFunctionDefine)],
      retry: 1
    })

    await agent.executePlan(
      'Find the latest case with the plaintiff being families of victims and return its metadata.'
    )

    expect(getLatestLawsuitsByPlaintiff).toBeCalled()
  })

  test('synthesizedFunction attempts to retry when it failed', async () => {
    let retry = 0
    class TestLLM extends LLMBase {
      override maxTokens: number = 9999
      public override async chatComplete(
        messages: ChatMLMessage[],
        config?: GenerateConfig | undefined
      ): Promise<ChatMLResponse> {
        if (messages[0]?.content.startsWith('You are an AI assistant')) {
          return {
            success: true,
            data: JSON.stringify([
              {
                thought:
                  "To find the latest case with the plaintiff being families of victims, we need to get the latest lawsuits by plaintiff 'families of victims'.",
                id: 1,
                functionName: 'getLatestLawsuitsByPlaintiff',
                args: {
                  plaintiff: 'families of victims',
                  arg1: false
                }
              },
              {
                thought: "To extract the metadata from the latest case, we need to use the 'getMeta' function.",
                id: 2,
                functionName: 'getMeta',
                args: {
                  lawsuit: '%@_1'
                }
              }
            ])
          }
        } else if (messages[0]?.content.startsWith('Extract meta data from a lawsuit full text')) {
          if (retry === 0) {
            retry += 1
            return { success: true, data: 'invalid' }
          }
          return {
            success: true,
            data: JSON.stringify({
              plaintiff: 'John Doe',
              defendant: 'Jane Smith',
              judgeOptions: ['Judge A', 'Judge B', 'Judge C']
            })
          }
        }

        return {
          success: false,
          data: ''
        }
      }
    }
    const llm = new TestLLM()
    const agent = createFlappyAgent({
      llm,
      features: [
        createSynthesizedFunction(SynthesizedFunctionDefine, { retry: 1 }),
        createInvokeFunction(InvokeFunctionDefine)
      ]
    })

    await agent.executePlan(
      'Find the latest case with the plaintiff being families of victims and return its metadata.'
    )

    expect(getLatestLawsuitsByPlaintiff).toBeCalled()
  })

  test('execute plan successfully', async () => {
    class TestLLM extends LLMBase {
      override maxTokens: number = 9999
      public override async chatComplete(
        messages: ChatMLMessage[],
        config?: GenerateConfig | undefined
      ): Promise<ChatMLResponse> {
        if (messages[0]?.content.startsWith('You are an AI assistant')) {
          return {
            success: true,
            data: JSON.stringify([
              {
                thought:
                  "To find the latest case with the plaintiff being families of victims, we need to get the latest lawsuits by plaintiff 'families of victims'.",
                id: 1,
                functionName: 'getLatestLawsuitsByPlaintiff',
                args: {
                  plaintiff: 'John Doe',
                  arg1: false
                }
              },
              {
                thought: "To extract the metadata from the latest case, we need to use the 'getMeta' function.",
                id: 2,
                functionName: 'getMeta',
                args: {
                  lawsuit: '%@_1'
                }
              }
            ])
          }
        } else if (messages[0]?.content.startsWith('Extract meta data from a lawsuit full text')) {
          return {
            success: true,
            data: JSON.stringify({
              plaintiff: 'John Doe',
              defendant: 'Jane Smith',
              judgeOptions: ['Judge A', 'Judge B', 'Judge C']
            })
          }
        }

        return {
          success: false,
          data: ''
        }
      }
    }
    const llm = new TestLLM()
    const agent = createFlappyAgent({
      llm,
      features: [createSynthesizedFunction(SynthesizedFunctionDefine), createInvokeFunction(InvokeFunctionDefine)]
    })

    await agent.executePlan(
      'Find the latest case with the plaintiff being families of victims and return its metadata.'
    )

    expect(getLatestLawsuitsByPlaintiff).toBeCalledWith([
      {
        plaintiff: 'John Doe',
        arg1: false
      }
    ])
  })
})

describe('code interpreter', () => {
  test(
    'call code interpreter successfully',
    async () => {
      class TestLLM extends LLMBase {
        override maxTokens: number = 9999
        public override async chatComplete(
          messages: ChatMLMessage[],
          config?: GenerateConfig | undefined
        ): Promise<ChatMLResponse> {
          return {
            success: true,
            data: JSON.stringify([
              {
                thought: '',
                id: 1,
                functionName: 'pythonSandbox',
                args: {
                  code: `def main():
    for chickens in range(0, 151):
        rabbits = 150 - chickens
        if 2*chickens + 4*rabbits == 396:
            return {'chickens': chickens}
    return {'chickens': None}
        `
                }
              }
            ])
          }
        }
      }
      const llm = new TestLLM()
      const agent = createFlappyAgent({
        llm,
        features: [createCodeInterpreter({ name: 'pythonSandbox' })]
      })

      const result = await agent.executePlan(
        'There are some rabbits and chickens in a barn. What is the number of chickens if there are 396 legs  and 150 heads in the barn?'
      )

      expect(result.result).toMatchInlineSnapshot(`
      "{'chickens': 102}
      "
    `)
    },
    60 * 1000
  )

  test(
    'call code interpreter attempts to retry when it failed',
    async () => {
      let retry = 0
      class TestLLM extends LLMBase {
        override maxTokens: number = 9999
        public override async chatComplete(
          messages: ChatMLMessage[],
          config?: GenerateConfig | undefined
        ): Promise<ChatMLResponse> {
          if (retry === 0) {
            retry += 1
            return { success: false, data: 'invalid' }
          }
          return {
            success: true,
            data: JSON.stringify([
              {
                thought: '',
                id: 1,
                functionName: 'pythonSandbox',
                args: {
                  code: `def main():
    for chickens in range(0, 151):
        rabbits = 150 - chickens
        if 2*chickens + 4*rabbits == 396:
            return {'chickens': chickens}
    return {'chickens': None}
        `
                }
              }
            ])
          }
        }
      }
      const llm = new TestLLM()
      const agent = createFlappyAgent({
        llm,
        features: [createCodeInterpreter()]
      })

      const result = await agent.executePlan(
        'There are some rabbits and chickens in a barn. What is the number of chickens if there are 396 legs  and 150 heads in the barn?'
      )

      expect(result.result).toMatchInlineSnapshot(`
      "{'chickens': 102}
      "
    `)
    },
    60 * 1000
  )
})
